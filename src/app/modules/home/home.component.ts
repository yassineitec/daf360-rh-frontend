import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  HomeService,
  HomeStats,
  WorkforceData,
  ProfileCompletionData,
  ProbationAlertDto,
  MissingDocumentDto,
  AnniversaireDto,
  NouveauEmployeDto,
  OnboardingSectionProgress,
} from './services/home.service';
import { UserStore } from '../../core/user.store';
import { PageComponent, PageHeaderComponent } from '@khalilrebhiitec/daf360';
import { MissingDocAlert, ProbationAlert } from './components/alert-card/alert-card.component';
import { EmployeeCardData, EmployeeCardSection } from './components/employee-card/employee-card.component';
import { AnniversaireItem } from './components/anniversary-widget/anniversary-widget.component';
import { NouveauItem } from './components/new-employees-widget/new-employees-widget.component';
import { QuickActionsSectionComponent } from './sections/quick-actions-section.component';
import { OverviewSectionComponent } from './sections/overview-section.component';
import { JoinersSectionComponent } from './sections/joiners-section.component';

/** How many joiner cards the "Derniers arrivés" strip shows. */
const JOINER_CARDS = 4;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    TranslatePipe,
    PageComponent,
    PageHeaderComponent,
    QuickActionsSectionComponent,
    OverviewSectionComponent,
    JoinersSectionComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private homeSvc    = inject(HomeService);
  private userStore       = inject(UserStore);
  private router          = inject(Router);
  private activatedRoute  = inject(ActivatedRoute);
  private translate       = inject(TranslateService);

  // ── Raw signals ────────────────────────────────────────────────────────────
  readonly loading                  = signal(true);
  readonly error                    = signal<string | null>(null);
  readonly stats                    = signal<HomeStats | null>(null);
  readonly workforce                = signal<WorkforceData | null>(null);
  readonly completion               = signal<ProfileCompletionData | null>(null);
  private readonly probationItems   = signal<ProbationAlertDto[]>([]);
  readonly probationTotal           = signal<number>(0);
  private readonly missingDocItems  = signal<MissingDocumentDto[]>([]);
  readonly missingDocsTotal         = signal<number>(0);
  private readonly anniversairesRaw = signal<AnniversaireDto[]>([]);
  readonly nouveauxEmployes         = signal<NouveauEmployeDto[]>([]);

  readonly currentUser = this.userStore.currentUser;

  // ── Computed for template ──────────────────────────────────────────────────
  readonly userName = computed(() => this.currentUser()?.fullName ?? 'Collaborateur');

  readonly probation = computed<ProbationAlert[]>(() =>
    this.probationItems().map((p: ProbationAlertDto) => ({
      profileId:       p.profileId,
      fullName:        p.fullName,
      photoUrl:        p.photoUrl,
      finPeriodeEssai: p.finPeriodeEssai,
      joursRestants:   p.joursRestants,
      contractEndDate: p.contractEndDate,
      department:      p.department,
      roleName:        p.roleName,
      gender:          p.gender,
    }))
  );

  readonly missingDocAlerts = computed<MissingDocAlert[]>(() =>
    this.missingDocItems().map((d: MissingDocumentDto) => ({
      profileId:   d.profileId,
      fullName:    d.fullName,
      missingDocs: d.missingDocs,
      urgency:     d.urgency,
    }))
  );

  /**
   * The strip only shows the most recent joiners; the backend already orders by hire
   * date desc, so slicing here is enough and avoids a second request — the activity
   * widget below consumes the same fetch in full.
   */
  readonly employeeCards = computed<EmployeeCardData[]>(() =>
    this.nouveauxEmployes().slice(0, JOINER_CARDS).map(emp => ({
      profileId:     emp.profileId,
      fullName:      emp.fullName,
      poste:         emp.grade,
      department:    emp.department,
      discipline:    emp.discipline   ?? null,
      contractLabel: this.contractLabel(emp.contractType),
      countryLabel:  emp.paysLabel    ?? null,
      startDate:     this.formatDate(emp.hireDate),
      photoUrl:      emp.photoUrl,
      gender:        emp.gender       ?? null,
      initials:      this.initials(emp.fullName),
      sections:      this.cardSections(emp.onboardingSections),
    }))
  );

  readonly anniversaires = computed<AnniversaireItem[]>(() =>
    this.anniversairesRaw().map(emp => ({
      profileId:   emp.profileId,
      fullName:    emp.fullName,
      dateOfBirth: emp.dateOfBirth,
    }))
  );

  readonly nouveaux = computed<NouveauItem[]>(() =>
    this.nouveauxEmployes().map(emp => ({
      profileId:  emp.profileId,
      fullName:   emp.fullName,
      hireDate:   emp.hireDate,
      grade:      emp.grade,
      department: emp.department,
      photoUrl:   emp.photoUrl,
      gender:     emp.gender ?? null,
    }))
  );

  ngOnInit(): void {
    this.homeSvc.load().subscribe({
      next: data => {
        this.stats.set(data.stats);
        this.workforce.set(data.workforce);
        this.completion.set(data.completion);
        this.probationItems.set(data.probation.items);
        this.probationTotal.set(data.probation.total);
        this.missingDocItems.set(data.missingDocuments.items);
        this.missingDocsTotal.set(data.missingDocuments.total);
        this.anniversairesRaw.set(data.anniversaires);
        this.nouveauxEmployes.set(data.nouveauxEmployes);
        // Each widget call falls back to an empty value so one dead endpoint can't
        // blank the page, but a partial load must still be visible — otherwise an
        // entirely-down backend looks like "no data".
        this.error.set(
          data.failed.length
            ? this.translate.instant('HOME.PARTIAL_LOAD_ERROR', { count: data.failed.length })
            : null,
        );
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.translate.instant('HOME.LOAD_ERROR'));
        this.loading.set(false);
      },
    });
  }

  onViewProfile(id: number | null): void {
    if (id != null) this.router.navigate(['../profiles', id], { relativeTo: this.activatedRoute });
  }

  onQuickAction(route: string): void {
    // Navigate relative to the home route so it resolves under /rh/…
    // (both standalone and inside the federated shell), like onViewProfile.
    this.router.navigate(['..', route], { relativeTo: this.activatedRoute });
  }

  private initials(name: string): string {
    return name.split(' ').slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
  }

  /**
   * Enum code → readable phrase. `contract_type` is a free varchar in the DB, so an
   * unmapped value falls back to the raw code rather than leaking a translation key.
   */
  private contractLabel(code: string | null): string | null {
    if (!code) return null;
    return this.translateOr(`HOME.EMPLOYEE_CARD.CONTRACT.${code.toUpperCase()}`, code);
  }

  /** Translates the section codes; an unmapped code shows as itself, not as a key. */
  private cardSections(sections: OnboardingSectionProgress[] | null | undefined): EmployeeCardSection[] {
    return (sections ?? []).map(s => ({
      key:    s.key,
      label:  this.translateOr(`HOME.EMPLOYEE_CARD.SECTION.${s.key}`, s.key),
      filled: s.filled,
      total:  s.total,
    }));
  }

  /** `instant` echoes the key back when it's missing — turn that into a usable fallback. */
  private translateOr(key: string, fallback: string): string {
    const label = this.translate.instant(key);
    return label === key ? fallback : label;
  }

  private formatDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(this.translate.currentLang() ?? 'fr', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    });
  }
}
