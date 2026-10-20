import { Component, OnInit, TemplateRef, inject, signal, computed, viewChild } from '@angular/core';
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
import { RefDataService } from '../../core/ref/ref-data.service';
import { PaysTimezone, RefDataItem } from '../../core/ref/ref-data.model';
import { flagDataUri } from '../admin/flag-svgs';
import {
  ModalRef, ModalService, PageComponent, PageHeaderComponent, SelectComponent, SelectOption,
} from '@khalilrebhiitec/daf360';
import { WorkforceDetailComponent } from './components/workforce-detail/workforce-detail.component';
import { MissingDocAlert, ProbationAlert } from './components/alert-card/alert-card.component';
import { EmployeeCardData, EmployeeCardSection } from './components/employee-card/employee-card.component';
import { AnniversaireItem } from './components/anniversary-widget/anniversary-widget.component';
import { NouveauItem } from './components/new-employees-widget/new-employees-widget.component';
import { QuickActionsSectionComponent } from './sections/quick-actions-section.component';
import { OverviewSectionComponent, WorkforceCardKey } from './sections/overview-section.component';
import { JoinersSectionComponent } from './sections/joiners-section.component';

/** How many joiner cards the "Derniers arrivés" strip shows. */
const JOINER_CARDS = 4;

/** Pop-up header of each workforce card — same title as the card itself. */
const DETAIL_TITLE_KEYS: Record<WorkforceCardKey, string> = {
  workforce: 'HOME.WORKFORCE_STATS.LABEL',
  ingproj:   'HOME.ENGINEER_PRO_STATS.LABEL',
  seniority: 'HOME.SENIORITY_STATS.LABEL',
};
const DETAIL_ICONS: Record<WorkforceCardKey, string> = {
  workforce: 'groups',
  ingproj:   'engineering',
  seniority: 'military_tech',
};

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    TranslatePipe,
    PageComponent,
    PageHeaderComponent,
    SelectComponent,
    WorkforceDetailComponent,
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
  private refData         = inject(RefDataService);

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

  // ── Country picker of the detail pop-up (same options as /rh/admin) ────────
  // The page itself has no country filter: its cards show every entity to a
  // cross-country admin, and their own entity to anyone else.
  /** Option value meaning "no filter" — the backend then counts every entity. */
  private static readonly ALL_PAYS = '0';

  private readonly availablePays = signal<PaysTimezone[]>([]);

  /**
   * Same permissions that open the cross-country scope server side (TenantService:
   * ADMIN_ROLES, RH_SUPER_ADMIN). Anyone else only ever sees their own entity, so the
   * picker would have nothing to switch to.
   */
  readonly canSwitchPays = computed(() =>
    this.userStore.isSuperAdmin() || this.userStore.hasPermission('ADMIN_ROLES'));

  readonly paysOptions = computed<SelectOption[]>(() => [
    { value: HomeComponent.ALL_PAYS, label: this.translate.instant('HOME.ALL_COUNTRIES') },
    ...this.availablePays().map(p => ({
      value:    String(p.id),
      label:    `${p.frenchLabel} (${p.isoCode})`,
      imageUrl: flagDataUri(p.isoCode),
    })),
  ]);

  // ── Department filter (list from /rh/admin?tab=ref-data → Départements) ────
  /** Option value meaning "every department". */
  private static readonly ALL_DEPTS = '0';

  private readonly departments = signal<RefDataItem[]>([]);

  /**
   * null = every department. Only narrows the detail pop-up — the cards on the page
   * itself always show the whole country.
   */
  readonly selectedDepartmentId = signal<number | null>(null);

  // ── Detail pop-up of a workforce card ──────────────────────────────────────
  private readonly modal = inject(ModalService);
  private modalRef?: ModalRef;
  private readonly detailTpl = viewChild.required<TemplateRef<unknown>>('detailTpl');

  /** Which card the pop-up shows. */
  readonly detailCard = signal<WorkforceCardKey>('workforce');
  /**
   * The pop-up's own country (null = all, i.e. the page's view). Reset on every
   * opening; changing it never touches the page behind.
   */
  readonly detailPaysId = signal<number | null>(null);
  readonly detailPaysValue = computed<string[]>(() =>
    [this.detailPaysId() != null ? String(this.detailPaysId()) : HomeComponent.ALL_PAYS]);

  /** The pop-up's own figures: the page's, until its country or department moves. */
  readonly detailWorkforce = signal<WorkforceData | null>(null);
  readonly detailLoading = signal(false);
  private detailSeq = 0;

  /** Country the `departments` list was loaded for — `undefined` until the first load. */
  private departmentsPaysId: number | null | undefined = undefined;

  readonly departmentOptions = computed<SelectOption[]>(() => {
    // Departments belong to one country: with "Tous les pays" the same label can exist in
    // several entities, so the country code tells them apart.
    const showCountry = this.detailPaysId() == null && this.canSwitchPays();
    const iso = new Map(this.availablePays().map(p => [p.id, p.isoCode]));
    return [
      { value: HomeComponent.ALL_DEPTS, label: this.translate.instant('HOME.ALL_DEPARTMENTS') },
      ...this.departments().map(d => {
        const code = showCountry && d.paysId != null ? iso.get(d.paysId) : undefined;
        return { value: String(d.id), label: code ? `${d.labelFr} (${code})` : d.labelFr };
      }),
    ];
  });

  readonly selectedDepartmentValue = computed<string[]>(() =>
    [this.selectedDepartmentId() != null ? String(this.selectedDepartmentId()) : HomeComponent.ALL_DEPTS]);

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
      missingDocLabels: d.missingDocLabels,
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
    if (this.canSwitchPays()) {
      this.refData.getPaysTimezones().subscribe(list => this.availablePays.set(list));
    }
    this.loadData();
  }

  /**
   * Opens the clicked card in a pop-up with its own country and department filters.
   * Both start from the page's view (every country, every department) each time: it's
   * a look into one card, not a page setting.
   */
  onCardOpen(card: WorkforceCardKey): void {
    this.detailCard.set(card);
    this.detailPaysId.set(null);
    this.selectedDepartmentId.set(null);
    this.detailWorkforce.set(this.workforce());
    this.detailLoading.set(false);
    this.detailSeq++;   // drop any answer still in flight from a previous pop-up
    if (this.departmentsPaysId !== this.detailPaysId()) this.loadDepartments();
    this.modalRef?.close();
    this.modalRef = this.modal.open({
      title: this.translate.instant(DETAIL_TITLE_KEYS[card]),
      icon:  DETAIL_ICONS[card],
      body:  this.detailTpl(),
      size:  'lg',
    });
  }

  /** Pop-up country picker. The department picked belongs to the old country — drop it. */
  onDetailPaysChange(values: string[]): void {
    const next = HomeComponent.toId(values[0]);
    if (next === this.detailPaysId()) return;
    this.detailPaysId.set(next);
    this.selectedDepartmentId.set(null);
    this.loadDepartments();
    this.refreshDetail();
  }

  onDepartmentChange(values: string[]): void {
    const next = HomeComponent.toId(values[0]);
    if (next === this.selectedDepartmentId()) return;
    this.selectedDepartmentId.set(next);
    this.refreshDetail();
  }

  /** Reloads the pop-up's figures for its country + department. */
  private refreshDetail(): void {
    const paysId = this.detailPaysId();
    const deptId = this.selectedDepartmentId();
    // Same filter as the page: its figures are already loaded.
    if (paysId == null && deptId == null) {
      this.detailSeq++;
      this.detailLoading.set(false);
      this.detailWorkforce.set(this.workforce());
      return;
    }
    const seq = ++this.detailSeq;
    this.detailLoading.set(true);
    this.homeSvc.getWorkforce(paysId, deptId).subscribe({
      next: data => {
        if (seq !== this.detailSeq) return;
        this.detailWorkforce.set(data);
        this.detailLoading.set(false);
      },
      error: () => {
        if (seq !== this.detailSeq) return;
        this.detailWorkforce.set(null);
        this.detailLoading.set(false);
      },
    });
  }

  /** Option value → id; the "all" option ('0') and anything invalid → null. */
  private static toId(value: string | undefined): number | null {
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  /**
   * Same endpoint as the Départements tab of /rh/admin?tab=ref-data. Without a paysId
   * the backend returns what the caller may read: their own entity, or every entity
   * for a cross-country admin.
   */
  private loadDepartments(): void {
    const paysId = this.detailPaysId();
    this.departmentsPaysId = paysId;
    this.departments.set([]);   // never show the previous country's list meanwhile
    this.refData.getDepartments(paysId ?? undefined).subscribe(list => {
      if (paysId === this.detailPaysId()) this.departments.set(list);
    });
  }

  private loadData(): void {
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
    // Split into segments: the router only splits the FIRST command on '/', so a nested
    // route like 'conges/inbox' would otherwise become one encoded segment and fall to '**'.
    this.router.navigate(['..', ...route.split('/')], { relativeTo: this.activatedRoute });
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
