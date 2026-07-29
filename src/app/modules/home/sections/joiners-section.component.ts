import { Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EmployeeCardComponent, EmployeeCardData } from '../components/employee-card/employee-card.component';
import { AnniversaryWidgetComponent, AnniversaireItem } from '../components/anniversary-widget/anniversary-widget.component';
import { NewEmployeesWidgetComponent, NouveauItem } from '../components/new-employees-widget/new-employees-widget.component';

/**
 * Home section 3 — the latest joiners' cards plus the activity widgets.
 *
 * The list is a fixed, short "who just arrived" strip: no search, no filter and no
 * view-all button by design — browsing the whole workforce is /rh/profiles' job.
 * The parent decides how many cards to pass.
 */
@Component({
  selector: 'rh-joiners-section',
  standalone: true,
  host: { class: 'block' },
  imports: [TranslatePipe, EmployeeCardComponent, AnniversaryWidgetComponent, NewEmployeesWidgetComponent],
  template: `
    <!-- Desktop / tablet -->
    <section class="hidden md:block border-t border-outline-variant pt-8">
      <h2 class="text-body-lg font-bold text-on-surface mb-6">
        {{ 'HOME.DIRECTORY.TITLE' | translate }}
      </h2>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div class="lg:col-span-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            @for (emp of employees(); track emp.profileId) {
              <rh-employee-card [employee]="emp" (viewProfile)="viewProfile.emit($event)" />
            } @empty {
              <p class="text-body-sm text-outline col-span-2 py-8 text-center">
                {{ 'HOME.DIRECTORY.EMPTY' | translate }}
              </p>
            }
          </div>
        </div>

        <aside class="hidden lg:flex lg:flex-col lg:gap-6">
          <rh-anniversary-widget [items]="anniversaires()" />
          <rh-new-employees-widget [items]="nouveaux()" />
        </aside>
      </div>

      <!-- Tablet (below lg): widgets stacked full-width under the cards -->
      <div class="lg:hidden mt-6 flex flex-col gap-6">
        <rh-anniversary-widget [items]="anniversaires()" />
        <rh-new-employees-widget [items]="nouveaux()" />
      </div>
    </section>

    <!-- Mobile — segmented switcher between the two browsable halves -->
    <div class="md:hidden flex flex-col gap-5">
      <div class="sticky top-0 z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur">
        <div class="flex items-center gap-1 p-1 rounded-full bg-surface-container-lowest border border-outline-variant">
          <button type="button"
            class="flex-1 h-9 rounded-full text-body-sm font-semibold transition-colors"
            [class.bg-tertiary]="tab() === 'joiners'"
            [class.text-white]="tab() === 'joiners'"
            [class.text-outline]="tab() !== 'joiners'"
            (click)="tab.set('joiners')">
            {{ 'HOME.MOBILE_TABS.DIRECTORY' | translate }}
          </button>
          <button type="button"
            class="flex-1 h-9 rounded-full text-body-sm font-semibold transition-colors"
            [class.bg-tertiary]="tab() === 'activity'"
            [class.text-white]="tab() === 'activity'"
            [class.text-outline]="tab() !== 'activity'"
            (click)="tab.set('activity')">
            {{ 'HOME.MOBILE_TABS.ACTIVITY' | translate }}
          </button>
        </div>
      </div>

      @if (tab() === 'joiners') {
        <div class="flex flex-col gap-4">
          @for (emp of employees(); track emp.profileId) {
            <rh-employee-card [employee]="emp" (viewProfile)="viewProfile.emit($event)" />
          } @empty {
            <p class="text-body-sm text-outline py-8 text-center">
              {{ 'HOME.DIRECTORY.EMPTY' | translate }}
            </p>
          }
        </div>
      } @else {
        <div class="flex flex-col gap-6">
          <rh-anniversary-widget [items]="anniversaires()" />
          <rh-new-employees-widget [items]="nouveaux()" />
        </div>
      }
    </div>
  `,
})
export class JoinersSectionComponent {
  readonly employees     = input<EmployeeCardData[]>([]);
  readonly anniversaires = input<AnniversaireItem[]>([]);
  readonly nouveaux      = input<NouveauItem[]>([]);

  readonly viewProfile = output<number | null>();

  readonly tab = signal<'joiners' | 'activity'>('joiners');
}
