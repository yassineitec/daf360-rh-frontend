import { Component, Injector, OnInit, computed, inject, signal } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { UserStore } from '../core/user.store';
import { AuthService } from '../core/auth.service';
import { SideNavComponent, PermissionService, CountryPickerComponent } from '@khalilrebhiitec/daf360';
import { CountryPickerService } from '../core/country-picker.service';
import type { NavItem, SideNavConfig } from '@khalilrebhiitec/daf360';
import { TranslateService } from '@ngx-translate/core';
import en from '@public/assets/i18n/en.json';
import fr from '@public/assets/i18n/fr.json';
import ar from '@public/assets/i18n/ar.json';
import { resolveInitialLang } from '../core/language-preference';
import { HelpCenterComponent } from '../shared/guide/help-center.component';
import { HelpChatComponent } from '../shared/guide/help-chat.component';
import { GuideHintComponent } from '../shared/guide/guide-hint.component';
interface AppNavDef {
  id: string;
  /** i18n key under NAV.*, resolved in `navItems` — never a literal label. */
  labelKey: string;
  icon: string;
  /**
   * Absent sur une entrée à ENFANTS : un parent ne navigue pas, il ouvre sa liste, et
   * seuls les enfants changent l'URL. La page qu'il ouvrait devient son premier enfant —
   * sinon le même clic navigue et déplie, et l'écran change sous une liste qui s'ouvre.
   */
  route?: string;
  /** Any-of gate; empty = visible to every authenticated user. */
  permissions: string[];
  /**
   * Sub-entries, rendered by `daf-side-nav` as an expandable group (one level only —
   * see `NavItem.children` in the lib). `route` is a full path relative to the shell,
   * so it holds several segments where a top-level entry holds one.
   */
  children?: AppNavDef[];
  /** A heading inside a group (lib NavItem.heading): a label, never an entry — no route. */
  heading?: boolean;
  /**
   * Other URL prefixes that light this entry up. For a leaf whose `route` is deeper than
   * the pages it stands for — Offboarding opens `offboarding/type/RESIGNATION`, yet the
   * full list and every `offboarding/:id` file belong to it too.
   */
  activeOn?: string[];
}

const APP_NAV_DEFS: AppNavDef[] = [
  { id: 'accueil', labelKey: 'NAV.ACCUEIL', icon: 'home', route: 'accueil', permissions: [] },
  { id: 'profiles', labelKey: 'NAV.PROFILES', icon: 'account_circle', route: 'profiles', permissions: [] },
  // « Journal d'audit » has no entry any more: it is a card of Administration (tab `audit`).
  //
  // « Pipeline RH » — the lifecycle board across every process (candidature, IT, onboarding,
  // CDI, offboarding). Its own entry, outside the group below: it is the overview of the
  // whole group, not one more step of it.
  {
    id: 'recrutement',
    labelKey: 'NAV.PIPELINE',
    icon: 'analytics',
    route: 'recrutement',
    permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE'],
  },
  // Lifecycle — ONE group for the screens of each step a person goes through, from
  // candidature to departure: candidatures, IT provisioning, onboarding, CDI conversions and
  // offboarding. The rail draws one level of children only, so a screen that used to be a
  // group of its own (IT provisioning: en cours + historique) is ONE entry whose sub-screens
  // are tabs inside the page. « Mes entretiens » is no longer here: it is the « Entretiens »
  // tab of the shell's self-service.
  //
  // No permission on the group itself: it shows as soon as one child does (see `visible`).
  {
    id: 'lifecycle',
    labelKey: 'NAV.LIFECYCLE',
    icon: 'conversion_path',
    permissions: [],
    children: [
      {
        id: 'candidates',
        labelKey: 'NAV.CANDIDATES',
        icon: 'group_add',
        route: 'candidates',
        permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE'],
      },
      // « Dossiers en cours » and « Historique » are the two tabs of this page.
      {
        id: 'it-provisioning',
        labelKey: 'NAV.IT_PROVISIONING',
        icon: 'devices',
        route: 'it-provisioning',
        permissions: ['IT_PROVISIONING'],
      },
      {
        id: 'onboarding',
        labelKey: 'NAV.ONBOARDING',
        icon: 'person_add',
        route: 'onboarding',
        permissions: ['HR_ONBOARDING'],
      },
      // CIVP → CDI requests: the validator's, the arbiter's and RH's queue, and each
      // requester's own list. Requests themselves are filed from the profile's contract card.
      {
        id: 'cdi-conversions',
        labelKey: 'NAV.CDI_CONVERSIONS',
        icon: 'workspace_premium',
        route: 'cdi-conversions',
        permissions: ['RH_REQUEST_CDI_CONVERSION', 'RH_VALIDATE_CDI_CONVERSION', 'RH_ARBITRATE_CDI_CONVERSION', 'RH_MANAGE_LIFECYCLE'],
      },
      // Was a group with one child per departure reason. RESIGNATION is the only reason
      // with a screen, so the entry opens it directly; when a second reason gets one, the
      // reasons become tabs of the offboarding page — never a second level in the rail.
      {
        id: 'offboarding',
        labelKey: 'NAV.OFFBOARDING',
        icon: 'logout',
        route: 'offboarding/type/RESIGNATION',
        activeOn: ['offboarding'],
        permissions: ['RH_MANAGE_OFFBOARDING', 'RH_VIEW_CONTRACTS', 'RH_MANAGE_LIFECYCLE'],
      },
    ],
  },
  // « Missions » — everything about a business trip, whoever handles it:
  // the manager planning missions for their team (current / history, RH_CREATE_MISSION)
  // and RH's billeterie desk pricing and validating them (RH_MANAGE_MISSION_BILLETERIE).
  // The label covers both desks, not only the manager's.
  //
  // The group carries the UNION of its children's codes, and each child keeps its own: a
  // manager sees the two mission lists, an RH ticketing officer only « Billeterie ».
  {
    id: 'missions',
    labelKey: 'NAV.MISSIONS_GROUP',
    icon: 'flight_takeoff',
    permissions: ['RH_CREATE_MISSION', 'RH_MANAGE_MISSION_BILLETERIE'],
    children: [
      {
        id: 'missions-current',
        labelKey: 'NAV.MISSIONS_CURRENT',
        icon: 'flight_takeoff',
        route: 'missions',
        permissions: ['RH_CREATE_MISSION'],
      },
      {
        id: 'missions-history',
        labelKey: 'NAV.MISSIONS_HISTORY',
        icon: 'history',
        route: 'missions/historique',
        permissions: ['RH_CREATE_MISSION'],
      },
      {
        id: 'billeterie',
        labelKey: 'NAV.BILLETERIE',
        icon: 'confirmation_number',
        route: 'billeterie',
        permissions: ['RH_MANAGE_MISSION_BILLETERIE'],
      },
    ],
  },
  // Absences — ONE group for the three kinds of leave and their statistics, split by
  // headings (NavItem.heading, lib 5.8): congés, autorisations, télétravail and the HR
  // statistics answer the same question — who is away, and how much — and were three
  // sibling groups plus a page left behind in the timesheet. The rail draws one level of
  // children only; the headings are what keep the families apart inside it.
  //
  // Headings carry no permission: the lib hides one that ends up with no entry under it, so
  // a manager who only has the queues sees three short blocks and nothing empty.
  //
  // Two screens DELIBERATELY have no door here: the employee's own congé request, a card of
  // the shell's self-service, and the type catalogue, a tab of Administration.
  {
    id: 'absences',
    labelKey: 'NAV.ABSENCES',
    icon: 'event_busy',
    permissions: ['GET_LEAVES', 'ADD_LEAVE', 'RESPONSE_LEAVE', 'GET_EMPLOYEES_LEAVES', 'GET_GLOBAL_LEAVES',
                  'SETTLE_LEAVES', 'RESPOND_MODIFICATION_MANAGER', 'RESPOND_MODIFICATION_HR', 'GET_HR_STATS'],
    children: [
      // Congés — three questions (what I must handle / what my team took / what the country
      // took), each behind its own permission.
      { id: 'absences-h-conges', labelKey: 'NAV.CONGES', icon: '', heading: true, permissions: [] },
      {
        id: 'conges-inbox',
        labelKey: 'NAV.CONGES_INBOX',
        icon: 'inbox',
        route: 'conges/inbox',
        permissions: ['GET_LEAVES', 'RESPONSE_LEAVE'],
      },
      {
        // Régularisations: filing a congé for someone else. Sits next to the queue because
        // it is the other half of the same desk — what to do when nobody asked in time.
        id: 'conges-settle',
        labelKey: 'NAV.CONGES_SETTLE',
        icon: 'sync',
        route: 'conges/settle',
        permissions: ['SETTLE_LEAVES'],
      },
      {
        // Stage 1 of a change request: the manager who granted the congé agrees to the new
        // dates. Right after the queue, because it is the same desk — the second thing that
        // can land on a manager about a congé they already decided.
        id: 'conges-modif-manager',
        labelKey: 'NAV.CONGES_MODIF_MANAGER',
        icon: 'edit_calendar',
        route: 'conges/modifications/manager',
        permissions: ['RESPOND_MODIFICATION_MANAGER'],
      },
      {
        // Stage 2, and the only one that writes. Next to Régularisations rather than to the
        // manager stage above: both are HR applying a change to a settled congé.
        id: 'conges-modif-hr',
        labelKey: 'NAV.CONGES_MODIF_HR',
        icon: 'published_with_changes',
        route: 'conges/modifications/hr',
        permissions: ['RESPOND_MODIFICATION_HR'],
      },
      {
        id: 'conges-team',
        labelKey: 'NAV.CONGES_TEAM',
        icon: 'groups',
        route: 'conges/team',
        permissions: ['GET_EMPLOYEES_LEAVES'],
      },
      {
        id: 'conges-global',
        labelKey: 'NAV.CONGES_GLOBAL',
        icon: 'public',
        route: 'conges/global',
        permissions: ['GET_GLOBAL_LEAVES'],
      },
      // Autorisations — short paid absences in minutes. A workflow shared with congés, no
      // model shared: its own block rather than a kind of congé.
      { id: 'absences-h-autorisations', labelKey: 'NAV.AUTORISATIONS', icon: '', heading: true, permissions: [] },
      {
        id: 'autorisations-queue',
        labelKey: 'NAV.AUTORISATIONS_QUEUE',
        icon: 'inbox',
        route: 'autorisations/queue',
        permissions: ['GET_LEAVES', 'RESPONSE_LEAVE'],
      },
      {
        id: 'autorisations-mine',
        labelKey: 'NAV.AUTORISATIONS_MINE',
        icon: 'person',
        route: 'autorisations/mine',
        permissions: ['ADD_LEAVE', 'GET_LEAVES'],
      },
      {
        id: 'autorisations-team',
        labelKey: 'NAV.AUTORISATIONS_TEAM',
        icon: 'groups',
        route: 'autorisations/team',
        permissions: ['GET_EMPLOYEES_LEAVES'],
      },
      {
        id: 'autorisations-global',
        labelKey: 'NAV.AUTORISATIONS_GLOBAL',
        icon: 'public',
        route: 'autorisations/global',
        permissions: ['GET_GLOBAL_LEAVES'],
      },
      // Télétravail — a day or half a day of remote work.
      { id: 'absences-h-teletravail', labelKey: 'NAV.TELETRAVAIL', icon: '', heading: true, permissions: [] },
      {
        id: 'teletravail-queue',
        labelKey: 'NAV.TELETRAVAIL_QUEUE',
        icon: 'inbox',
        route: 'teletravail/queue',
        permissions: ['GET_LEAVES', 'RESPONSE_LEAVE'],
      },
      {
        id: 'teletravail-mine',
        labelKey: 'NAV.TELETRAVAIL_MINE',
        icon: 'person',
        route: 'teletravail/mine',
        permissions: ['ADD_LEAVE', 'GET_LEAVES'],
      },
      {
        id: 'teletravail-team',
        labelKey: 'NAV.TELETRAVAIL_TEAM',
        icon: 'groups',
        route: 'teletravail/team',
        permissions: ['GET_EMPLOYEES_LEAVES'],
      },
      {
        id: 'teletravail-global',
        labelKey: 'NAV.TELETRAVAIL_GLOBAL',
        icon: 'public',
        route: 'teletravail/global',
        permissions: ['GET_GLOBAL_LEAVES'],
      },
      // Approved congé and maladie days per employee and month (moved from the timesheet).
      { id: 'absences-h-suivi', labelKey: 'NAV.ABSENCES_REPORTING', icon: '', heading: true, permissions: [] },
      {
        id: 'absences-stats',
        labelKey: 'NAV.ABSENCES_STATS',
        icon: 'bar_chart',
        route: 'absences/statistiques',
        permissions: ['GET_HR_STATS'],
      },
    ],
  },
  {
    id: 'requests', labelKey: 'NAV.REQUESTS', icon: 'inbox',
    permissions: ['HR_UPDATE_PROFILE', 'HR_ADMIN_ROLES'],
    children: [
      {
        // L'écran que « Demandes » ouvrait avant de devenir un groupe.
        id: 'requests-inbox',
        labelKey: 'NAV.REQUESTS_INBOX',
        icon: 'inbox',
        route: 'requests',
        permissions: ['HR_UPDATE_PROFILE', 'HR_ADMIN_ROLES'],
      },
      {
        id: 'requests-history',
        labelKey: 'NAV.REQUESTS_HISTORY',
        icon: 'history',
        // The historique page: decided HR requests + recruitment demands, one tab each.
        route: 'requests-history',
        permissions: ['RH_VIEW_RECRUITMENT_DEMAND', 'RH_CREATE_RECRUITMENT_DEMAND', 'RH_APPROVE_RECRUITMENT_DEMAND'],
      },
    ],
  },
  {
    id: 'admin',
    labelKey: 'NAV.ADMIN',
    icon: 'admin_panel_settings',
    route: 'admin',
    // Same codes as the route guard: CREATE_ABSENCE_TYPE opens the « Types de congés » tab,
    // HR_CREATE_PROFILE / HR_UPDATE_PROFILE the « Journal d'audit » one (no sidebar entry).
    permissions: ['ADMIN_ROLES', 'HR_ADMIN_ROLES', 'GET_ROLES', 'ADMIN_LISTS', 'ADMIN_REGIMES', 'ADMIN_BREAKS', 'ADMIN_NOTIFICATIONS', 'CREATE_ABSENCE_TYPE',
                  'HR_CREATE_PROFILE', 'HR_UPDATE_PROFILE'],
  },
];

@Component({
  selector: 'app-hr-shell',
  standalone: true,
  imports: [RouterOutlet, SideNavComponent, CountryPickerComponent, HelpCenterComponent, HelpChatComponent, GuideHintComponent],
  templateUrl: './hr-shell.component.html',
  styleUrl: './hr-shell.component.scss',
  host: { style: 'display:block;height:100%' },
})
export class HrShellComponent implements OnInit {
  private userStore = inject(UserStore);
  private perm = inject(PermissionService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private injector = inject(Injector);
  private translate = inject(TranslateService);
  /** Sélecteur de pays du bas de la barre latérale (lib 5.19.0). */
  readonly countryPicker = inject(CountryPickerService);

  constructor() {
    // Populate the RH translation store. The shell route now provides an ISOLATED
    // child TranslateService (see app.routes), so this writes to RH's OWN store and
    // never clobbers the shell host's translations. Runs before child routes render
    // so pipes find the keys on first eval; setTranslation before use() lets
    // loadOrExtendLanguage skip the loader.
    this.translate.setTranslation('fr', fr, true);
    this.translate.setTranslation('en', en, true);
    this.translate.setTranslation('ar', ar, true);
    // getCurrentLang() returns string | null (snapshot, not signal).
    // Only activate 'fr' when nothing is set; respect whatever lang the shell picked.
    // Le repli prend la préférence ENREGISTRÉE et non 'fr' en dur : le service de
    // traduction de RH est isolé, il démarre donc vide même quand l'hôte est en anglais.
    if (!this.translate.getCurrentLang()) {
      this.translate.use(resolveInitialLang());
    }
  }

  onboardingCount = signal(0);

  private readonly rawUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url, injector: this.injector },
  );

  // daf-side-nav highlights on an exact `activeRoute === item.route` match, but nav
  // routes are single segments ('accueil', 'admin', …) while the URL is absolute
  // (e.g. /rh/admin/roles). Map the live URL to the matching nav segment (longest
  // match first) so nested/child routes still light up their top-level item.
  //
  // Sub-entries are in the same pool, and longest-match-first is what makes them win:
  // on /rh/offboarding/type/RESIGNATION both 'offboarding/type/RESIGNATION' and
  // 'offboarding' match, and returning the parent would leave the child permanently
  // unlit. The lib lights the parent anyway, via its own `hasActiveChild`.
  readonly activeRoute = computed(() => {
    const url = (this.rawUrl() ?? '').split(/[?#]/)[0];
    const match = APP_NAV_DEFS.flatMap((d) => [d, ...(d.children ?? [])])
      // Les groupes n'ont plus de route : sans ce filtre, `(^|/)(/|$)` correspondrait à
      // n'importe quelle URL et le premier groupe rencontré éteindrait toute la barre.
      .filter((d): d is AppNavDef & { route: string } => !!d.route)
      // One candidate per prefix: the entry's own route, then its `activeOn` aliases — all
      // resolving to the entry's route, which is what the lib compares against.
      .flatMap((d) => [d.route, ...(d.activeOn ?? [])].map((prefix) => ({ prefix, route: d.route })))
      .sort((a, b) => b.prefix.length - a.prefix.length)
      .find((d) => new RegExp(`(^|/)${d.prefix}(/|$)`).test(url));
    return match ? match.route : '';
  });

  // `translate.instant` is a plain call, not reactive — reading `currentLang()` (a
  // Signal in ngx-translate v18) is what makes these recompute on a language switch.
  // Without it the sidebar keeps the labels of whatever language was active at first
  // render. daf-side-nav takes NavItem/SideNavConfig objects, not templates, so the
  // translate PIPE isn't an option here.
  readonly navItems = computed<NavItem[]>(() => {
    this.translate.currentLang();
    const visible = (def: AppNavDef): boolean =>
      (def.permissions.length === 0 || this.perm.hasAny(def.permissions)) &&
      // A group shows only with at least one real entry under it — headings do not count,
      // the lib already hides a heading left with nothing beneath it.
      (!def.children?.length || def.children.some((c) => !c.heading && visible(c)));

    const toNavItem = (def: AppNavDef): NavItem => {
      const children = (def.children ?? []).filter(visible).map(toNavItem);
      return {
        id: def.id,
        label: this.translate.instant(def.labelKey),
        icon: def.icon,
        ...(def.heading ? { heading: true } : {}),
        // Jamais de route sur un groupe — le clic ne doit que déplier.
        ...(children.length ? {} : { route: def.route }),
        // Omitted when empty: `children: []` would still make the lib treat the item as
        // an expandable group, so it would render a chevron that opens nothing.
        ...(children.length ? { children } : {}),
        ...(def.id === 'onboarding' && this.onboardingCount() > 0
          ? { badge: this.onboardingCount() }
          : {}),
        // The collapsed group still says something waits inside it: its children's badges
        // (each count is only ever loaded for a user who sees that child).
        ...(def.id === 'lifecycle' && this.onboardingCount() > 0
          ? { badge: this.onboardingCount() }
          : {}),
      };
    };

    return APP_NAV_DEFS.filter(visible).map(toNavItem);
  });

  readonly sideNavConfig = computed<SideNavConfig>(() => {
    this.translate.currentLang();
    return {
      sectionLabel: this.translate.instant('NAV.SECTION_LABEL'),
      collapsible: true,
    };
  });

  ngOnInit(): void {
    this.countryPicker.load();
    // NOTE: the remote's styles.css is injected + awaited by the shell
    // (ensureRemoteStyles) before this route activates — no runtime injection here.
    if (this.userStore.hasPermission('HR_ONBOARDING')) {
      this.http.get<any[]>(`${environment.hrApiUrl}/api/hr/onboarding/pending`).subscribe({
        next: (list) => this.onboardingCount.set(list.length),
        error: () => {},
      });
    }
    const paysId = this.userStore.currentUser()?.paysId;
    // if (paysId && this.userStore.hasPermission('RH_VIEW_CONTRACTS')) {
    //   this.http.get<any[]>(`${environment.hrApiUrl}/api/hr/lifecycle/alerts?paysId=${paysId}&acknowledged=false`).subscribe({
    //     next: list => this.lifecycleAlertCount.set(list.length),
    //     error: () => {},
    //   });
    // }
  }

  onNavClick(item: NavItem): void {
    // Seules des feuilles arrivent ici : depuis la lib 4.27.0, un item à enfants n'émet
    // plus `itemClick`, son clic ne fait que déplier. Le garde sur `children` est donc
    // parti avec la montée de version.
    if (item.route) {
      // Split: a sub-entry's route is multi-segment ('offboarding/type/RESIGNATION'),
      // and one array element per segment is unambiguous where a single slash-bearing
      // string relies on the router re-parsing it.
      this.router.navigate(item.route.split('/'), { relativeTo: this.activatedRoute });
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
