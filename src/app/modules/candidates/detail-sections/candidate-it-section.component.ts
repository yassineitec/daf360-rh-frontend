import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { BadgeOptions, ButtonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { statusBadge } from '../../../shared/status-badge.utils';
import { ProfileFieldComponent } from '../../../shared/detail/profile-field.component';
import { ItProvisioningSummary } from '../candidate.model';

/** The four licences the provisioning record tracks, in the order IT provisions them. */
const LICENCES: { label: string; key: keyof ItProvisioningSummary }[] = [
  { label: 'Office 365', key: 'licenseOffice365' },
  { label: 'AutoCAD',    key: 'licenseAutocad'   },
  { label: 'Revit',      key: 'licenseRevit'     },
  { label: 'Kaspersky',  key: 'licenseKaspersky' },
];

/** Total equipment slots the provisioning form tracks — matches /rh/it-provisioning. */
const ASSET_SLOTS = 6;

/**
 * "Provisioning IT" tab of `/rh/candidates/:id` — the read-only view of the IT
 * record, with a link into `/rh/it-provisioning/:id` for whoever can manage it.
 */
@Component({
  selector: 'rh-candidate-it-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionCardComponent, ProfileFieldComponent, StatusBadgeComponent, ButtonComponent, TranslatePipe],
  host: { class: 'block' },
  template: `
    <rh-section-card
      [title]="'CANDIDATES.DETAIL.IT_PROVISIONING' | translate"
      icon="computer">

      @if (provisioning(); as prov) {
        <div class="mb-4 flex items-center justify-between gap-3">
          <daf-badge [label]="badge(prov.status).label" [options]="badge(prov.status).options" />
          @if (prov.ms365Email) {
            <span class="flex min-w-0 items-center gap-2 rounded-lg bg-secondary-container px-3 py-2">
              <span class="material-symbols-outlined text-[18px] text-on-secondary-container">alternate_email</span>
              <span class="truncate text-[13px] font-medium text-on-secondary-container">{{ prov.ms365Email }}</span>
            </span>
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <rh-profile-field variant="tile"
            [label]="'CANDIDATES.DETAIL.EQUIPMENT' | translate"
            [value]="assets()" />
          <div class="flex flex-col rounded-xl bg-surface-container-high/50 p-4">
            <span class="mb-1 text-[10px] font-bold uppercase tracking-widest text-outline">Active Directory</span>
            <daf-badge
              [label]="(prov.adAccountCreated ? 'CANDIDATES.DETAIL.ACCOUNT_CREATED' : 'CANDIDATES.DETAIL.WAITING') | translate"
              [options]="{ variant: prov.adAccountCreated ? 'success' : 'neutral', size: 'sm', dot: true }" />
          </div>
        </div>

        <p class="mb-2 mt-5 text-[10px] font-bold uppercase tracking-widest text-outline">
          {{ 'CANDIDATES.DETAIL.LICENSES' | translate }}
        </p>
        <div class="flex flex-wrap gap-2">
          @for (lic of licences; track lic.label) {
            <daf-badge [label]="lic.label" [options]="licenceOptions(prov, lic.key)" />
          }
        </div>

        @if (canManage()) {
          <div class="mt-5 border-t border-outline-variant/40 pt-4">
            <daf-button
              [options]="{ variant: 'secondary', size: 'sm', iconStart: 'open_in_new',
                           label: ('CANDIDATES.DETAIL.MANAGE_PROVISIONING' | translate) }"
              (onClick)="manage.emit(prov.id)" />
          </div>
        }
      } @else {
        <p class="text-[13px] text-outline">{{ 'CANDIDATES.DETAIL.NO_IT_TASK' | translate }}</p>
      }
    </rh-section-card>
  `,
})
export class CandidateItSectionComponent {
  readonly provisioning = input<ItProvisioningSummary | null>(null);
  readonly canManage    = input(false);

  readonly manage = output<number>();

  protected readonly licences = LICENCES;
  protected readonly badge = statusBadge;

  protected readonly assets = computed(() => {
    const prov = this.provisioning();
    return prov ? `${prov.assetsProvided} / ${ASSET_SLOTS}` : null;
  });

  /** Provisioned licences read as a positive state; the rest stay neutral. */
  protected licenceOptions(prov: ItProvisioningSummary, key: keyof ItProvisioningSummary): BadgeOptions {
    return { variant: prov[key] ? 'success' : 'neutral', size: 'sm', dot: true };
  }
}
