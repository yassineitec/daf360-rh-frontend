import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AvatarComponent, StatusBadgeComponent } from '@khalilrebhiitec/daf360';

import { CongesService } from '../conges.service';
import { CongeRow, LeaveBalances } from '../models/conge.model';
import {
  avatarFor, formatDays, initialsOf, localeDate, localeOf, periodOf, stateKey, stateVariant,
} from '../conge-display';

/**
 * One congé, in full — the body of the consult, approve and refuse modals.
 *
 * ONE COMPONENT FOR ALL THREE, on purpose. A manager approving a request needs exactly what a
 * manager consulting one needs: who, what type, which days, how many, why, and who already
 * touched it. Three bespoke bodies would have drifted, and the approve dialog — the one where
 * the information actually changes an outcome — was the thinnest of the three.
 *
 * WHAT IT SHOWS THAT THE ROW DOES NOT
 * -----------------------------------------------------------------------------
 *   · the reason, in full rather than truncated into the avatar's subtitle;
 *   · the refusal motive, when there is one;
 *   · who filed it, when that is not the employee — a régularisation looks identical to a
 *     normal request in a list, and approving one is a different act;
 *   · the decision trail (who decided, when), which a list has no room for.
 *
 * Purely presentational: a row in, nothing out. The modal's buttons belong to the page.
 */
@Component({
  selector: 'rh-conge-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, StatusBadgeComponent, TranslatePipe],
  template: `
    @if (row(); as r) {
      <div class="flex flex-col gap-4">

        <!-- Identity + state, the two things read first. -->
        <div class="flex items-center gap-3">
          <!-- Photo → initials → gendered placeholder, all decided by daf-avatar from what it
               is given: avatarUrl wins when present, a failed load falls back to initials,
               and avatarFor already substitutes the placeholder when there is no photo. -->
          <daf-avatar
            [data]="{ name: r.collaborateurName || '', initials: initials(), avatarUrl: photo() }"
            size="lg" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-semibold text-on-surface">
              {{ r.collaborateurName || ('CONGES.UNKNOWN' | translate) }}
            </p>
            <p class="truncate text-body-sm text-on-surface-variant">{{ r.typeLabel }}</p>
          </div>
          <daf-badge
            [label]="stateLabel()"
            [options]="{ variant: variant(), size: 'sm', dot: true }" />
        </div>

        <!-- A régularisation is not a request the employee made. Said plainly, because
             approving one on the assumption they asked for it is the mistake to prevent. -->
        @if (isSettled()) {
          <p class="flex items-start gap-2 rounded-lg bg-info/10 px-3 py-2 text-body-sm">
            <span class="material-symbols-outlined text-[18px]">sync</span>
            {{ 'CONGES.DETAIL.SETTLED_BY' | translate: { name: r.createdByName || ('CONGES.UNKNOWN' | translate) } }}
          </p>
        }

        <dl class="grid grid-cols-2 gap-x-4 gap-y-3">
          <div class="flex flex-col gap-0.5">
            <dt class="text-body-sm text-on-surface-variant">{{ 'CONGES.COL.PERIOD' | translate }}</dt>
            <dd class="m-0 font-medium">{{ period() }}</dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-body-sm text-on-surface-variant">{{ 'CONGES.COL.DAYS' | translate }}</dt>
            <dd class="m-0 font-medium tabular-nums">{{ days() }}</dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-body-sm text-on-surface-variant">{{ 'CONGES.DETAIL.CATEGORY' | translate }}</dt>
            <dd class="m-0 font-medium">{{ r.categoryLabel }}</dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-body-sm text-on-surface-variant">{{ 'CONGES.COL.APPROVER' | translate }}</dt>
            <dd class="m-0 font-medium">{{ r.responsableName || '—' }}</dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-body-sm text-on-surface-variant">{{ 'CONGES.COL.SUBMITTED' | translate }}</dt>
            <dd class="m-0 font-medium">{{ submitted() }}</dd>
          </div>
          <div class="flex flex-col gap-0.5">
            <dt class="text-body-sm text-on-surface-variant">{{ 'CONGES.DETAIL.JUSTIFICATIF' | translate }}</dt>
            <dd class="m-0 font-medium">
              <!-- Three states, not two. A file that can be opened is the point of the
                   whole feature; "claimed" is what the 716 migrated rows carry, where the
                   old checkbox was ticked and no document was ever stored. -->
              @if (r.justificatifDocumentId != null) {
                <a [href]="justificationHref()" target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center gap-1 text-primary hover:underline">
                  <span class="material-symbols-outlined text-body-lg">description</span>
                  {{ 'CONGES.DETAIL.OPEN_FILE' | translate }}
                </a>
              } @else if (r.justificatif) {
                <span class="text-on-surface-variant">{{ 'CONGES.DETAIL.CLAIMED' | translate }}</span>
              } @else {
                {{ 'CONGES.DETAIL.NO' | translate }}
              }
            </dd>
          </div>
        </dl>

        <!-- The employee's remaining allowance, when the caller may read it.
             Placed under the request rather than beside the name: it is context for the
             decision, not part of the request's identity. The type that this congé actually
             draws on is highlighted, because that is the one the approval will move. -->
        @if (balances(); as b) {
          <div class="flex flex-col gap-1.5">
            <p class="text-body-sm text-on-surface-variant">{{ 'CONGES.DETAIL.BALANCES' | translate }}</p>
            <div class="flex flex-wrap gap-2">
              @for (cell of balanceCells(); track cell.key) {
                <div class="flex flex-1 basis-28 flex-col gap-0.5 rounded-lg px-3 py-2"
                     [class]="cell.affected ? 'bg-primary/10' : 'bg-surface-container-low'">
                  <span class="text-body-sm text-on-surface-variant">{{ cell.label }}</span>
                  <span class="font-semibold tabular-nums">{{ cell.value }}</span>
                </div>
              }
            </div>
          </div>
        }

        @if (r.reason) {
          <div class="flex flex-col gap-1">
            <p class="text-body-sm text-on-surface-variant">{{ 'CONGES.DETAIL.REASON' | translate }}</p>
            <p class="m-0 whitespace-pre-line rounded-lg bg-surface-container-low px-3 py-2">{{ r.reason }}</p>
          </div>
        }

        <!-- The decision, once there is one. A refusal's motive is the single most-read
             field on this screen, so it is never collapsed behind anything. -->
        @if (r.etatDemande === 'REFUSE' && r.motifRefus) {
          <div class="flex flex-col gap-1">
            <p class="text-body-sm text-on-surface-variant">{{ 'CONGES.DETAIL.MOTIF_REFUS' | translate }}</p>
            <p class="m-0 whitespace-pre-line rounded-lg bg-danger/10 px-3 py-2">{{ r.motifRefus }}</p>
          </div>
        }

        @if (r.decidedByName || r.dateValidation) {
          <p class="text-body-sm text-on-surface-variant">
            {{ 'CONGES.DETAIL.DECIDED' | translate: { name: r.decidedByName || ('CONGES.UNKNOWN' | translate), date: decided() } }}
          </p>
        }
      </div>
    }
  `,
})
export class CongeDetailComponent {
  private translate = inject(TranslateService);
  private svc = inject(CongesService);

  readonly row = input.required<CongeRow | null>();

  /**
   * The employee's remaining days, when the page could fetch them. Null hides the block
   * entirely rather than showing three dashes — "we did not ask" and "nothing recorded" are
   * different statements and only the second deserves a dash.
   */
  readonly balances = input<LeaveBalances | null>(null);

  /**
   * Which balance this request draws on, so the affected tile can be picked out.
   *
   * Passed in rather than derived from the type code: whether a type tracks a balance, and
   * which one, is configuration on `AbsenceTypes`, and guessing it from the code here would
   * be exactly the hardcoding the configurable catalogue replaced.
   */
  readonly balanceField = input<string | null>(null);

  private readonly locale = computed(() => localeOf(this.translate.currentLang()));

  protected readonly initials = computed(() => initialsOf(this.row()?.collaborateurName));
  protected readonly photo = computed(() => {
    const r = this.row();
    return r ? avatarFor(r) : undefined;
  });
  protected readonly variant = computed(() =>
    this.row() ? stateVariant(this.row()!.etatDemande) : 'neutral');
  protected readonly stateLabel = computed(() => {
    const r = this.row();
    return r ? this.translate.instant(stateKey(r.etatDemande)) : '';
  });
  protected readonly period = computed(() => {
    const r = this.row();
    return r ? periodOf(r, this.locale()) : '—';
  });
  protected readonly days = computed(() => formatDays(this.row()?.totalJours, this.locale()));
  protected readonly submitted = computed(() =>
    localeDate(this.row()?.createdAt?.slice(0, 10), this.locale()));
  protected readonly decided = computed(() =>
    localeDate(this.row()?.dateValidation, this.locale()));

  /** Null renders as a dash, not a zero — "not recorded" is not "none left". */
  protected readonly balanceCells = computed(() => {
    this.translate.currentLang();
    const b = this.balances();
    const field = this.balanceField();
    const loc = this.locale();
    return [
      { key: 'CONGE', label: this.translate.instant('CONGES.BALANCE.CONGE'),
        value: formatDays(b?.soldeConge, loc), affected: field === 'CONGE' },
      { key: 'MALADIE', label: this.translate.instant('CONGES.BALANCE.MALADIE'),
        value: formatDays(b?.soldeMaladie, loc), affected: field === 'MALADIE' },
      { key: 'TELETRAVAIL', label: this.translate.instant('CONGES.BALANCE.TELETRAVAIL'),
        value: formatDays(b?.soldeTeletravail, loc), affected: field === 'TELETRAVAIL' },
    ];
  });

  /** Opened in a new tab: the endpoint replies `inline`, so the browser renders it. */
  protected readonly justificationHref = computed(() => {
    const r = this.row();
    return r ? this.svc.justificationUrl(r.id) : '';
  });

  /** Filed by someone other than the person it is for — the same test the server uses. */
  protected readonly isSettled = computed(() => {
    const r = this.row();
    return !!r && r.createdBy != null && r.createdBy !== r.collaborateurId;
  });
}
