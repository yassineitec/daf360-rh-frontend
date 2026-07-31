import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BadgeVariant, CardComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { genderLabel } from '../../../shared/utils/gender.utils';
import { CandidateDetail } from '../candidate.model';
import { candidateAvatar, candidateInitials } from '../candidate-display';

export interface CandidatePill {
  label: string;
  variant: BadgeVariant;
}

/**
 * Left column of `/rh/candidates/:id` — the sticky identity card, mirroring
 * `rh-identity-card` on `/rh/profiles/:id`: avatar, name, position, status pills,
 * then the candidate's own details inline.
 *
 * Coordonnées is the one section that is **not** a tab, exactly as *État civil &
 * Identité* isn't one on the profile page: it stays on screen next to whichever
 * tab is open.
 *
 * No photo FAB — a candidate has no photo endpoint, so the avatar is the gender
 * illustration with an initials fallback and nothing to upload.
 *
 * The name is a `<p>`, not a heading: `daf-page-header` owns the page's single `h1`.
 */
@Component({
  selector: 'rh-candidate-identity-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent, StatusBadgeComponent, ProfileFieldComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <daf-card [options]="{ variant: 'glass', radius: 'xl', padding: 'none' }">

      <!-- Avatar · nom · pills -->
      <div class="flex flex-col items-center gap-1 p-8 text-center">
        <div class="mb-3">
          <div class="h-32 w-32 overflow-hidden rounded-full border-4 border-surface-container-lowest
                      bg-surface-container p-1.5 shadow-xl ring-1 ring-primary/10">
            @if (avatar(); as src) {
              <img [src]="src" [alt]="candidate().firstName + ' ' + candidate().lastName"
                   class="h-full w-full rounded-full object-cover object-top" />
            } @else {
              <span class="flex h-full w-full items-center justify-center rounded-full bg-primary/10
                           text-[28px] font-bold text-primary">{{ initials() }}</span>
            }
          </div>
        </div>

        <p class="text-[20px] font-black leading-tight text-on-surface">
          {{ candidate().firstName }} {{ candidate().lastName }}
        </p>
        @if (candidate().appliedPosition) {
          <p class="text-[14px] font-medium text-outline">{{ candidate().appliedPosition }}</p>
        }

        @if (pills().length) {
          <div class="mt-3 flex flex-wrap justify-center gap-2">
            @for (pill of pills(); track pill.label) {
              <daf-badge [label]="pill.label" [options]="{ variant: pill.variant, size: 'sm', pill: true }" />
            }
          </div>
        }
      </div>

      <!-- Coordonnées & identité -->
      <div class="border-t border-outline-variant/40 px-8 pb-8 pt-5">
        <h2 class="mb-6 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-outline">
          <span class="material-symbols-outlined text-[16px]">contact_page</span>
          {{ 'CANDIDATES.DETAIL.CONTACT' | translate }}
        </h2>

        <div class="grid grid-cols-2 gap-x-4 gap-y-5">
          <rh-profile-field [wide]="true"
            [label]="'CANDIDATES.DETAIL.EMAIL' | translate"
            [value]="candidate().emailPersonal" />
          <rh-profile-field
            [label]="'CANDIDATES.DETAIL.PHONE' | translate"
            [value]="candidate().phone" />
          <rh-profile-field
            [label]="'CANDIDATES.DETAIL.DOB' | translate"
            [value]="candidate().dateOfBirth" />
          <rh-profile-field
            [label]="'CANDIDATES.DETAIL.GENDER' | translate"
            [value]="gender()" />
          <rh-profile-field
            [label]="'CANDIDATES.DETAIL.NATIONALITY' | translate"
            [value]="candidate().nationality" />
          <rh-profile-field
            [label]="'CANDIDATES.DETAIL.NATIONAL_ID' | translate"
            [value]="candidate().nationalId" />
          @if (candidate().location) {
            <rh-profile-field
              [label]="'CANDIDATES.DETAIL.LOCATION' | translate"
              [value]="candidate().location" />
          }
        </div>
      </div>

    </daf-card>
  `,
})
export class CandidateIdentityCardComponent {
  readonly candidate = input.required<CandidateDetail>();
  readonly pills     = input<CandidatePill[]>([]);

  protected readonly avatar   = computed(() => candidateAvatar(this.candidate().gender));
  protected readonly initials = computed(() =>
    candidateInitials(this.candidate().firstName, this.candidate().lastName),
  );
  protected readonly gender = computed(() => {
    const g = this.candidate().gender;
    return g ? genderLabel(g) : null;
  });
}
