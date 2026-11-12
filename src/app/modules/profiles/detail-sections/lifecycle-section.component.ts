import { Component, inject, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, ProgressBarComponent, SectionTitleComponent, SkeletonComponent, StatusBadgeComponent,
} from '@khalilrebhiitec/daf360';

import {
  ContractListDto, ContractTransitionHistoryDto,
  STATUS_CONFIG, CONTRACT_TYPE_CONFIG,
} from '../lifecycle/contract-lifecycle.model';
import { SectionCardComponent } from '../../../shared/detail/section-card.component';
import { ContractHistoryDto } from '../contract-history/contract-history.model';
import { fmtDate } from './field-bridges';
import { CdiConversion, isInProgress } from '../../cdi-conversions/cdi-conversion.model';
import { cdiStatusKey, cdiStatusVariant } from '../../cdi-conversions/cdi-conversion-display';

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
    StatusBadgeComponent, ProgressBarComponent, SectionTitleComponent,
    RouterLink, DecimalPipe, TranslatePipe,
  ],
  host: { class: 'block' },
  template: `
    <rh-section-card [title]="'PROFILES.SECTIONS.LIFECYCLE' | translate" icon="event_repeat">
      <!-- The sectionAction host must be a STATIC root node of the projected
           content: an element nested inside an @if block lives in an embedded
           view, so ng-content's selector never matches it and the button falls
           into the card body instead of the header row. -->
      <div sectionAction>
        @if (canEdit()) {
          <daf-button
            [options]="{ variant: 'primary', size: 'sm', iconStart: 'add',
                         label: ('PROFILES.LC.NEW_CONTRACT' | translate) }"
            (onClick)="newContract.emit()" />
        }
      </div>

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

        <!-- ── Contrats ─────────────────────────────────────────────────────── -->
        <section class="flex flex-col gap-3">
          <daf-section-title [title]="'PROFILES.LC.SECTION_CONTRACTS' | translate" />

          @for (c of contracts(); track c.id) {
            <article class="flex flex-col gap-3.5 rounded-xl border border-outline-variant bg-surface-container-low p-4"
                     [class.opacity-80]="!c.isActive">

              <!-- En-tête : type + statuts | actions -->
              <header class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex min-w-0 flex-col gap-1.5">
                  <h4 class="m-0 text-[14px] font-bold text-on-surface">{{ c.contractTypeLabel || typeLabel(c.contractTypeCode) }}</h4>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <daf-badge [label]="statusLabel(c.currentStatusCode)"
                               [options]="{ variant: statusVariant(c.currentStatusCode), size: 'sm' }" />
                    @if (c.isActive) {
                      <daf-badge [label]="'PROFILES.LC.ACTIVE' | translate" [options]="{ variant: 'teal', pill: true, size: 'sm' }" />
                    }
                    @if (c.dossierLocked) {
                      <daf-badge [label]="'PROFILES.LC.LOCKED' | translate" [options]="{ variant: 'danger', pill: true, size: 'sm' }" />
                    }
                  </div>
                </div>

                @if (c.isActive && !c.dossierLocked) {
                  <div class="flex flex-col items-end gap-1.5">
                    @if (canEdit()) {
                      <!-- One « Décider » button for both deadlines (end of trial, end of
                           contract): the choices come from the backend, as configured in
                           Administration (Type de contrat / Échéances de contrat). -->
                      @if (hasDeadline(c)) {
                        <daf-button [options]="{ variant: 'primary', size: 'sm', iconStart: 'gavel',
                                                 label: ((c.currentStatusCode === 'PERIODE_ESSAI'
                                                   ? 'PROFILES.DECISION.BUTTON_TRIAL' : 'PROFILES.DECISION.BUTTON_END') | translate) }"
                          (onClick)="decide.emit(c.id)" />
                      }
                      @if (c.contractTypeCode === 'CDD' && c.currentStatusCode === 'ACTIF') {
                        <daf-button variant="secondary" [options]="{ label: ('PROFILES.LC.CONVERT_CDI' | translate), size: 'sm' }"
                          (onClick)="convertCdi.emit(c.id)" />
                      }
                    }
                    <!-- CIVP: requesting is its own permission (managers, not only RH); the
                         conversion itself appears once the request is approved, for RH. -->
                    @if (c.contractTypeCode === 'CIVP' && c.currentStatusCode === 'ACTIF') {
                      @if (canRequestCdi() && !cdiInProgress(c.id)) {
                        <daf-button variant="secondary" [options]="{ label: ('CDI_CONVERSION.CARD.REQUEST' | translate), size: 'sm', iconStart: 'workspace_premium' }"
                          (onClick)="requestCdi.emit(c.id)" />
                      }
                      @if (cdiRequest(c.id)?.canConvert) {
                        <daf-button [options]="{ variant: 'primary', label: ('PROFILES.LC.CONVERT_CDI' | translate), size: 'sm' }"
                          (onClick)="convertCdi.emit(c.id)" />
                      }
                    }
                  </div>
                }
              </header>

              <!-- Période d'essai en cours : échéance, avancement, renouvellement. -->
              @if (c.currentStatusCode === 'PERIODE_ESSAI' && trialEnd(c)) {
                <div class="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3.5 py-3">
                  <div class="flex flex-wrap items-center gap-2 text-[12px]">
                    <span class="material-symbols-outlined text-[16px] text-warning">hourglass_top</span>
                    <span class="font-semibold text-on-surface">{{ 'PROFILES.LC.TRIAL_LINE' | translate }}</span>
                    <span class="text-on-surface-variant">
                      @if (c.periodeEssaiRenouvelee && c.dateFinPeRenouvellement) {
                        {{ 'PROFILES.LC.TRIAL_RENEWED_END' | translate:{ date: fmtDate(c.dateFinPeRenouvellement), initial: fmtDate(c.dateFinPeriodeEssai) } }}
                      } @else {
                        {{ 'PROFILES.LC.TRIAL_END' | translate:{ date: fmtDate(trialEnd(c)) } }}
                      }
                    </span>
                    <span [class]="daysChipClass(daysUntil(trialEnd(c))!)"
                          class="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                      {{ daysChipLabel(daysUntil(trialEnd(c))!) }}
                    </span>
                  </div>

                  @if (trialProgress(c); as p) {
                    <daf-progress-bar class="block w-full"
                      [value]="p.pct"
                      [options]="{ max: 100, size: 'sm', variant: progressVariant(daysUntil(trialEnd(c))!), showPercent: false }" />
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-on-surface-variant">
                      <span>{{ 'PROFILES.LC.TRIAL_ELAPSED' | translate:{ done: p.done, total: p.total } }}</span>
                      @if (trialDays(c); as d) {
                        <span class="text-outline">·</span>
                        <span>
                          {{ 'PROFILES.LC.TRIAL_DAYS' | translate:{ n: d.initial } }}
                          @if (d.renewal) { {{ 'PROFILES.LC.TRIAL_PLUS_RENEWAL' | translate:{ n: d.renewal } }} }
                        </span>
                      }
                      <span class="text-outline">·</span>
                      @if (c.trialRenewable) {
                        <span [class]="(c.trialRenewalCount ?? 0) >= (c.trialMaxRenewals ?? 1) ? 'text-outline' : 'font-semibold text-success'">
                          {{ 'PROFILES.LC.TRIAL_RENEWABLE' | translate:{ used: c.trialRenewalCount ?? 0, max: c.trialMaxRenewals ?? 1 } }}
                        </span>
                      } @else {
                        <span class="text-outline">{{ 'PROFILES.LC.TRIAL_NOT_RENEWABLE' | translate }}</span>
                      }
                    </div>
                  }
                </div>
              }

              <!-- Informations du contrat -->
              <dl class="m-0 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[10px] font-semibold uppercase tracking-[0.4px] text-outline">{{ 'PROFILES.LC.F_START' | translate }}</dt>
                  <dd class="m-0 text-[13px] font-medium text-on-surface">{{ fmtDate(c.dateDebut) }}</dd>
                </div>
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[10px] font-semibold uppercase tracking-[0.4px] text-outline">{{ 'PROFILES.LC.F_END' | translate }}</dt>
                  <dd class="m-0 flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-on-surface">
                    @if (c.dateFinReelle) {
                      {{ fmtDate(c.dateFinReelle) }}
                    } @else if (c.dateFinPrevue) {
                      {{ fmtDate(c.dateFinPrevue) }}
                      @if ((daysUntil(c.dateFinPrevue) ?? 999) <= 30 && c.isActive) {
                        <span [class]="daysChipClass(daysUntil(c.dateFinPrevue)!)"
                              class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                          {{ daysChipLabel(daysUntil(c.dateFinPrevue)!) }}
                        </span>
                      }
                    } @else {
                      <span class="text-on-surface-variant">{{ 'PROFILES.LC.F_END_NONE' | translate }}</span>
                    }
                  </dd>
                </div>
                <!-- Préavis (V69): frozen on THIS contract; the source explains the figure. -->
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[10px] font-semibold uppercase tracking-[0.4px] text-outline">{{ 'PROFILES.LC.NOTICE_PERIOD' | translate }}</dt>
                  <dd class="m-0 text-[13px] font-medium text-on-surface">
                    @if (c.noticePeriodDays !== null && c.noticePeriodDays !== undefined) {
                      {{ 'PROFILES.LC.NOTICE_DAYS' | translate:{ days: c.noticePeriodDays } }}
                      @if (c.noticePeriodSource) {
                        <span class="block text-[11px] font-normal text-outline">{{ 'PROFILES.LC.NOTICE_SOURCE.' + c.noticePeriodSource | translate }}</span>
                      }
                    } @else if (c.defaultNoticeDays !== null && c.defaultNoticeDays !== undefined) {
                      {{ 'PROFILES.LC.NOTICE_DAYS' | translate:{ days: c.defaultNoticeDays } }}
                      <span class="block text-[11px] font-normal text-outline">{{ 'PROFILES.LC.NOTICE_DEFAULT_GRADE' | translate }}</span>
                    } @else {
                      <span class="text-on-surface-variant">{{ 'PROFILES.LC.NOTICE_NONE' | translate }}</span>
                      <span class="block text-[11px] font-normal text-outline">{{ 'PROFILES.LC.NOTICE_NONE_HINT' | translate }}</span>
                    }
                  </dd>
                </div>
                <div class="flex flex-col gap-0.5">
                  <dt class="text-[10px] font-semibold uppercase tracking-[0.4px] text-outline">{{ 'PROFILES.LC.F_REF' | translate }}</dt>
                  <dd class="m-0 text-[13px] font-medium text-on-surface">{{ c.referenceContrat || '—' }}</dd>
                </div>
              </dl>

              <!-- CIVP → CDI request (V119): its status and a link to the desk where it is decided. -->
              @if (c.contractTypeCode === 'CIVP' && cdiRequest(c.id); as req) {
                <div class="flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3 text-[12px]">
                  <span class="text-on-surface-variant">{{ 'CDI_CONVERSION.CARD.LABEL' | translate }} :</span>
                  <daf-badge [label]="cdiStatusKey(req) | translate"
                             [options]="{ variant: cdiStatusVariant(req), size: 'sm', pill: true }" />
                  <a [routerLink]="['/rh/cdi-conversions', req.id]" class="font-semibold text-teal hover:underline">
                    {{ 'CDI_CONVERSION.CARD.OPEN' | translate }}
                  </a>
                </div>
              }
            </article>
          } @empty {
            <p class="m-0 text-[13px] text-on-surface-variant">{{ 'PROFILES.LC.NONE' | translate }}</p>
          }
        </section>

        <!-- Lifecycle transition history -->
        @if (history().length) {
          <div>
            <daf-section-title class="mb-3 block" [title]="'PROFILES.LC.TRANSITIONS_HISTORY' | translate" />
            <div class="relative flex flex-col">
              @for (h of history(); track h.id; let last = $last) {
                <div class="flex gap-2.5">
                  <div class="flex w-4 shrink-0 flex-col items-center">
                    <div class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-tertiary"></div>
                    @if (!last) { <div class="mt-0.5 w-0.5 flex-1 bg-outline-variant"></div> }
                  </div>
                  <div class="mb-2 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5">
                    <div class="mb-1 flex flex-wrap items-center gap-2">
                      <span class="material-symbols-outlined text-[16px] text-on-surface-variant">{{ actionIcon(h.actionCode) }}</span>
                      @if (actionLabel(h.actionCode); as a) {
                        <span class="text-[12px] font-semibold text-on-surface">{{ a }}</span>
                      }
                      <!-- No « before » badge for a creation: there was no status yet. -->
                      @if (h.statutAvant && h.statutAvant !== h.statutApres) {
                        <daf-badge [label]="statusLabel(h.statutAvant)" [options]="{ variant: statusVariant(h.statutAvant), size: 'sm' }" />
                        <span class="text-[11px] text-outline">→</span>
                      }
                      @if (!h.statutAvant || h.statutAvant !== h.statutApres) {
                        <daf-badge [label]="statusLabel(h.statutApres)" [options]="{ variant: statusVariant(h.statutApres), size: 'sm' }" />
                      }
                      @if (h.previousDate || h.newDate) {
                        <span class="text-[11px] font-semibold text-warning">
                          {{ fmtDate(h.previousDate) || '—' }} → {{ fmtDate(h.newDate) || '—' }}
                        </span>
                      }
                      <span class="ml-auto whitespace-nowrap text-[10px] text-outline">
                        {{ fmtDate(h.triggeredAt) }}
                        @if (h.triggeredByName) { · {{ 'PROFILES.LC.BY' | translate:{ name: h.triggeredByName } }} }
                      </span>
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

        <!-- ── Dossier log (historique_contrat) ─────────────────────────────
             Same card shell as the contracts above, deliberately: it describes the same
             events from the dossier's side (document type, salary, motif) and used to be a
             separate component with its own design. Read-only — entries are written by the
             Nouveau contrat form, which creates the contract and logs it in one submit. -->
        @if (contractLog().length) {
          <div>
            <daf-section-title class="mb-3 block" [title]="'PROFILES.HISTORY.TITLE' | translate" />
            <div class="flex flex-col gap-2.5">
              @for (c of contractLog(); track c.id) {
                <div class="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3.5">
                  <div class="flex flex-wrap items-start justify-between gap-2.5">
                    <div class="flex flex-1 flex-col gap-1.5">

                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-[13px] font-bold text-on-surface">{{ c.typeContratLabelFr }}</span>
                        <daf-badge
                          [label]="(c.typeDocument === 'CONTRAT_INITIAL' ? 'PROFILES.HISTORY.DOC_INITIAL' : 'PROFILES.HISTORY.DOC_AMENDMENT') | translate"
                          [options]="{ variant: c.typeDocument === 'CONTRAT_INITIAL' ? 'info' : 'warning', pill: true, size: 'sm' }" />
                        @if (c.isActive) {
                          <daf-badge [label]="'PROFILES.HISTORY.ACTIVE' | translate"
                                     [options]="{ variant: 'teal', pill: true, size: 'sm' }" />
                        }
                      </div>

                      <div class="flex flex-wrap gap-3.5 text-[12px] text-on-surface-variant">
                        <span>
                          {{ 'PROFILES.HISTORY.FROM_LABEL' | translate }} {{ fmtDate(c.dateEffet) }}
                          @if (c.dateFin) { → {{ fmtDate(c.dateFin) }} }
                          @else { → {{ 'PROFILES.HISTORY.ONGOING' | translate }} }
                        </span>
                        @if (c.salaireNet) {
                          <span class="font-semibold text-on-surface">
                            {{ c.salaireNet | number:'1.0-0' }} {{ 'PROFILES.HISTORY.TND_NET_MONTH_SUFFIX' | translate }}
                          </span>
                        }
                      </div>

                      @if (c.motif) {
                        <span class="text-[11px] italic text-outline">{{ c.motif }}</span>
                      }
                      @if (c.commentaire) {
                        <span class="text-[11px] text-outline">{{ c.commentaire }}</span>
                      }
                    </div>

                    <span class="shrink-0 whitespace-nowrap text-[11px] text-outline">
                      {{ fmtDate(c.dateCreation) }}
                    </span>
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
  /**
   * The dossier log (`historique_contrat`) — document type, salary, motif per contract event.
   *
   * A separate input from `history`, which is the lifecycle STATE-machine timeline. The two
   * were previously two components on one tab, each with its own chrome and its own add
   * button; this section now renders both so there is one design and one write path.
   */
  readonly contractLog = input<ContractHistoryDto[]>([]);
  readonly loading     = input(false);
  readonly canEdit     = input(false);
  readonly candidateId = input<number | null>(null);
  /** Latest CIVP → CDI request per contract id (V119); null = none yet. */
  readonly cdiRequests   = input<Record<number, CdiConversion | null>>({});
  readonly canRequestCdi = input(false);

  readonly newContract   = output<void>();
  /** « Décider » on a contract deadline — the page opens the decision modal. */
  readonly decide        = output<number>();
  readonly convertCdi    = output<number>();
  readonly requestCdi    = output<number>();

  protected readonly fmtDate = fmtDate;
  protected readonly cdiStatusKey = cdiStatusKey;
  protected readonly cdiStatusVariant = cdiStatusVariant;

  protected cdiRequest(contractId: number): CdiConversion | null {
    return this.cdiRequests()[contractId] ?? null;
  }

  protected cdiInProgress(contractId: number): boolean {
    return isInProgress(this.cdiRequest(contractId));
  }

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

  /** End of the trial as it stands — the renewal's date once renewed (backend effectiveTrialEnd). */
  protected trialEnd(c: ContractListDto): string | null {
    return c.periodeEssaiRenouvelee && c.dateFinPeRenouvellement
      ? c.dateFinPeRenouvellement
      : c.dateFinPeriodeEssai;
  }

  /**
   * Whether the contract is at a deadline something can be decided on — mirrors the
   * backend's ContractDecisionService.momentOf: in trial, or an active contract that has an
   * end (any non-CDI, or a CDI with a planned end).
   */
  protected hasDeadline(c: ContractListDto): boolean {
    if (!c.isActive || c.dossierLocked) return false;
    if (c.currentStatusCode === 'PERIODE_ESSAI') return true;
    if ((c.currentStatusCode as string) === 'RECRUTEMENT') return false;
    return !!c.dateFinPrevue || c.contractTypeCode !== 'CDI';
  }

  /** Trial length in days: initial, and the renewal on top of it (0 when not renewed). */
  protected trialDays(c: ContractListDto): { initial: number; renewal: number } | null {
    if (!c.dateDebut || !c.dateFinPeriodeEssai) return null;
    const days = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
    const initial = days(c.dateDebut, c.dateFinPeriodeEssai);
    const renewal = c.periodeEssaiRenouvelee && c.dateFinPeRenouvellement
      ? days(c.dateFinPeriodeEssai, c.dateFinPeRenouvellement) : 0;
    return initial > 0 ? { initial, renewal } : null;
  }

  /** How far into the trial we are: days elapsed / total (renewal included), as a %. */
  protected trialProgress(c: ContractListDto): { pct: number; done: number; total: number } | null {
    const end = this.trialEnd(c);
    if (!c.dateDebut || !end) return null;
    const day = 86_400_000;
    const total = Math.round((new Date(end).getTime() - new Date(c.dateDebut).getTime()) / day);
    if (total <= 0) return null;
    const done = Math.min(total, Math.max(0, Math.floor((Date.now() - new Date(c.dateDebut).getTime()) / day)));
    return { pct: Math.round((done / total) * 100), done, total };
  }

  /** Same thresholds as the J–N chip. */
  protected progressVariant(days: number): 'danger' | 'warning' | 'teal' {
    return days <= 7 ? 'danger' : days <= 14 ? 'warning' : 'teal';
  }

  /** An icon per kind of event, so the timeline reads at a glance. */
  protected actionIcon(code: string | null): string {
    switch (code) {
      case 'CREATE_CONTRACT':                 return 'note_add';
      case 'RENEW_TRIAL': case 'RENEWAL_CDD':
      case 'RENEW_CDD':   case 'EXTEND':      return 'update';
      case 'VALIDATE_PE': case 'CONFIRM_TRIAL': return 'verified';
      case 'RUPTURE_PE':  case 'BREAK_TRIAL':
      case 'END_CONTRACT':                    return 'block';
      default:                                return 'swap_horiz';
    }
  }

  /** Label of a decision in the timeline (null for plain transitions — the badges say it all). */
  protected actionLabel(code: string | null): string | null {
    if (!code) return null;
    const key = 'PROFILES.DECISION.ACTION.' + code;
    const label = this.translate.instant(key);
    return label !== key ? label : null;
  }

  protected daysUntil(date: string | null): number | null {
    if (!date) return null;
    return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
  }

  /** « J–16 » comme sur l'accueil ; « J+3 » une fois l'échéance dépassée. */
  protected daysChipLabel(days: number): string {
    return days >= 0 ? `J–${days}` : `J+${-days}`;
  }

  /** Mêmes seuils et couleurs que `ProbationCardComponent.daysChipClass` (accueil). */
  protected daysChipClass(days: number): string {
    if (days <= 7)  return 'bg-red-600 text-white';
    if (days <= 14) return 'bg-orange-400 text-white';
    return 'bg-yellow-300 text-yellow-900';
  }
}
