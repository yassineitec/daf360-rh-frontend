import { Component, computed, input, output } from '@angular/core';
import { SkeletonComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe } from '@ngx-translate/core';
import { EmployeeListItem } from '../models/profile.model';
import { ProfileGridCardComponent } from '../components/profile-grid-card/profile-grid-card.component';

/**
 * Card view of the employee directory.
 *
 * Stateless by design: selection, search and filters all live in
 * `ProfileListComponent`, which is what lets the user flip between this and the
 * table view without losing any of them. Never hold view state here.
 */
@Component({
  selector: 'rh-profiles-cards-section',
  standalone: true,
  imports: [ProfileGridCardComponent, SkeletonComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    @if (loading()) {
      <div class="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-5">
        @for (i of skeletons(); track i) {
          <daf-skeleton variant="block" radius="xl" height="320px" width="100%" />
        }
      </div>
    } @else if (!employees().length) {
      <div class="flex flex-col items-center justify-center h-64 text-outline">
        <span class="material-symbols-outlined text-display mb-3">person_search</span>
        <p class="text-body-lg font-medium">{{ 'PROFILES.LIST.NO_EMPLOYEES' | translate }}</p>
        <p class="text-[13px] mt-1">{{ 'PROFILES.LIST.ADJUST_FILTERS' | translate }}</p>
      </div>
    } @else {
      @let selIds = selectedIds();
      <div class="grid grid-cols-1 min-[420px]:grid-cols-2 xl:grid-cols-3 gap-5">
        @for (emp of employees(); track emp.userId) {
          <rh-profile-grid-card
            [employee]="emp"
            [selected]="selIds.has(emp.userId)"
            (viewProfile)="viewProfile.emit($event)"
            (onSelect)="toggleSelect.emit($event)"
            (onEdit)="edit.emit($event)"
            (onDelete)="remove.emit($event)" />
        }
      </div>
    }
  `,
})
export class ProfilesCardsSectionComponent {
  readonly employees   = input.required<EmployeeListItem[]>();
  readonly selectedIds = input.required<Set<number>>();
  /** Re-fetch in progress — shows placeholder cards, not the page skeleton (§5). */
  readonly loading     = input<boolean>(false);
  /** How many placeholder cards to show; the page passes the current page size. */
  readonly skeletonCount = input<number>(6);

  readonly viewProfile  = output<number | null>();
  readonly toggleSelect = output<{ userId: number; checked: boolean }>();
  readonly edit         = output<number>();
  readonly remove       = output<number>();

  protected readonly skeletons = computed(() =>
    Array.from({ length: Math.min(this.skeletonCount(), 12) }, (_, i) => i),
  );
}
