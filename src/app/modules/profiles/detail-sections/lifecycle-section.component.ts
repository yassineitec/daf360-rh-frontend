import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonComponent, SkeletonComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import {
  ContractListDto, ContractTransitionHistoryDto,
  STATUS_CONFIG, CONTRACT_TYPE_CONFIG,
} from '../lifecycle/contract-lifecycle.model';
import { SectionCardComponent } from './section-card.component';
import { fmtDate } from './field-bridges';

/**
 * Contrats & cycle de vie tab — the contract list with its per-contract
 * transitions, plus the lifecycle history timeline.
 *
 * Kept in the page rather than moved into the drawer: it is primary HR data and
 * its actions open modals, which would end up stacked over a drawer scrim.
 *
 * Every action is an output — the modals, their forms and the service calls all
 * stay on the page, which already owns `ModalService` and the lifecycle service.
 */
@Component({
  selector: 'rh-lifecycle-section',
  standalone: true,
  imports: [
    SectionCardComponent, ButtonComponent, SkeletonComponent,
    StatusBadgeComponent, RouterLink, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <rh-section-card [title]="'PROFILES.SECTIONS.LIFECYCLE' | translate" icon="event_repeat">
      @if (canEdit()) {
        <daf-button sectionAction
          [options]="{ variant: 'primary', size: 'sm', iconStart: 'add',
                       label: ('PROFILES.LC.NEW_CONTRACT' | translate) }"
          (onClick)="newContract.emit()" />
      }

    <div class="flex flex-col gap-5">

      @if (loading()) {
        @for (i of [0, 1]; track i) {
          <daf-skeleton variant="block" radius="xl" width="100%" height="96px" />
        }
      } @else {

        <!-- Provenance candidat -->
        @if (candidateId(); as cid) {
          <div class="flex items-center gap-2 rounded-xl bg-success/10 px-3.5 py-2.5 text-[13px] text-success">
            <span class="material-symbols-outlined text-[16px]">person_search</span>
            <span>{{ 'PROFILES.LC.FROM_CANDIDATE' | translate }}</span>
            <a [routerLink]="['/rh/candidates', cid]"
               class="ml-1 font-semibold text-teal hover:underline">
              {{ 'PROFILES.LC.VIEW_CANDIDATE' | translate }}
            </a>
          </div>
        }

        @for (c of contracts(); track c.id) {
          <div class="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3.5">
            <div class="flex flex-wrap items-start justify-between gap-2.5">
              <div class="flex flex-1 flex-col gap-1.5">

                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-[13px] font-bold text-on-surface">{{ typeLabel(c.contractTypeCode) }}</span>
                  <daf-badge [label]="statusLabel(c.currentStatusCode)"
                             [options]="{ variant: statusVariant(c.currentStatusCode), size: 'sm' }" />
                  @if (c.isActive) {
                    <daf-badge [label]="'PROFILES.LC.ACTIVE' | translate" [options]="{ variant: 'teal', pill: true, size: 'sm' }" />
                  }
                  @if (c.dossierLocked) {
                    <daf-badge [label]="'PROFILES.LC.LOCKED' | translate" [options]="{ variant: 'danger', pill: true, size: 'sm' }" />
                  }
                </div>

                <div class="flex flex-wrap gap-3.5 text-[12px] text-on-surface-variant">
                  <span>{{ 'PROFILES.LC.START' | translate:{ date: fmtDate(c.dateDebut) } }}</span>
                  @if (c.dateFinPrevue) {
                    <span>{{ 'PROFILES.LC.END_EXPECTED' | translate:{ date: fmtDate(c.dateFinPrevue) } }}</span>
                    @if ((daysUntil(c.dateFinPrevue) ?? 999) <= 30 && c.isActive) {
                      <span class="font-semibold text-warning">
                        {{ 'PROFILES.LC.DAYS_LEFT' | translate:{ days: daysUntil(c.dateFinPrevue) } }}
                      </span>
                    }
                  }
                  @if (c.dateFinPeriodeEssai && c.currentStatusCode === 'PERIODE_ESSAI') {
                    <span class="font-semibold text-warning">
                      {{ 'PROFILES.LC.TRIAL_UNTIL' | translate:{ date: fmtDate(c.dateFinPeriodeEssai), days: daysUntil(c.dateFinPeriodeEssai) } }}
                    </span>
                  }
                </div>

                @if (c.referenceContrat) {
                  <span class="text-[11px] text-outline">{{ 'PROFILES.LC.REF' | translate:{ ref: c.referenceContrat } }}</span>
                }
              </div>

              @if (canEdit() && c.isActive && !c.dossierLocked) {
                <div class="flex flex-col items-end gap-1.5">
                  @if (c.currentStatusCode === 'PERIODE_ESSAI') {
                    <daf-button variant="secondary" [options]="{ label: ('PROFILES.LC.VALIDATE_TRIAL' | translate), size: 'sm' }"
                      (onClick)="validateTrial.emit(c.id)" />
                  }
                  @if (c.contractTypeCode === 'CDD' && c.currentStatusCode === 'ACTIF') {
                    <daf-button variant="secondary" [options]="{ label: ('PROFILES.LC.RENEW_CDD' | translate), size: 'sm' }"
                      (onClick)="renewCdd.emit(c.id)" />
                    <daf-button variant="secondary" [options]="{ label: ('PROFILES.LC.CONVERT_CDI' | translate), size: 'sm' }"
                      (onClick)="convertCdi.emit(c.id)" />
                  }
                </div>
              }
            </div>
          </div>
        } @empty {
          <p class="m-0 text-[13px] text-on-surface-variant">{{ 'PROFILES.LC.NONE' | translate }}</p>
        }

        <!-- Lifecycle transition history -->
        @if (history().length) {
          <div>
            <p class="mt-0 mb-2.5 text-[11px] font-bold uppercase tracking-[0.4px] text-on-surface-variant">
              {{ 'PROFILES.LC.TRANSITIONS_HISTORY' | translate }}
            </p>
            <div class="relative flex flex-col">
              @for (h of history(); track h.id; let last = $last) {
                <div class="flex gap-2.5">
                  <div class="flex w-4 shrink-0 flex-col items-center">
                    <div class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-tertiary"></div>
                    @if (!last) { <div class="mt-0.5 w-0.5 flex-1 bg-outline-variant"></div> }
                  </div>
                  <div class="mb-2 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5">
                    <div class="mb-1 flex items-center gap-2">
                      <daf-badge [label]="statusLabel(h.statutAvant)" [options]="{ variant: statusVariant(h.statutAvant), size: 'sm' }" />
                      <span class="text-[11px] text-outline">→</span>
                      <daf-badge [label]="statusLabel(h.statutApres)" [options]="{ variant: statusVariant(h.statutApres), size: 'sm' }" />
                      <span class="ml-auto text-[10px] text-outline-variant">{{ fmtDate(h.triggeredAt) }}</span>
                    </div>
                    @if (h.commentaire) {
                      <p class="m-0 mt-0.5 text-[11px] italic text-on-surface-variant">{{ h.commentaire }}</p>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </div>
    </rh-section-card>
  `,
})
export class LifecycleSectionComponent {
  private translate = inject(TranslateService);

  readonly contracts   = input<ContractListDto[]>([]);
  readonly history     = input<ContractTransitionHistoryDto[]>([]);
  readonly loading     = input(false);
  readonly canEdit     = input(false);
  readonly candidateId = input<number | null>(null);

  readonly newContract   = output<void>();
  readonly validateTrial = output<number>();
  readonly renewCdd      = output<number>();
  readonly convertCdi    = output<number>();

  protected readonly fmtDate = fmtDate;

  protected statusLabel(code: string): string {
    return STATUS_CONFIG[code as keyof typeof STATUS_CONFIG]
      ? this.translate.instant('PROFILES.CONTRACT_STATUS.' + code)
      : code;
  }

  protected statusVariant(code: string) {
    return STATUS_CONFIG[code as keyof typeof STATUS_CONFIG]?.variant ?? ('neutral' as const);
  }

  protected typeLabel(code: string): string {
    return CONTRACT_TYPE_CONFIG[code as keyof typeof CONTRACT_TYPE_CONFIG]
      ? this.translate.instant('PROFILES.CONTRACT_TYPE.' + code)
      : code;
  }

  protected daysUntil(date: string | null): number | null {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
  }
}
