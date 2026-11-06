/**
 * A page that has a guide, as listed by the « Centre d'aide » (/rh/aide).
 * `guideKey` is the `storageKey` of the page's `rh-page-guide`; `route` is where to go
 * before starting it, relative to the RH shell.
 */
export interface GuidePageDef {
  guideKey: string;
  labelKey: string;
  icon: string;
  route: string;
  /** Any-of gate; empty = every user. Same rule as the sidebar's entries. */
  permissions: string[];
  /**
   * Help-center tab the guide is listed under, for a sub-page (the profile file sits
   * under « Profils »). Omitted = the guide has its own tab, keyed by `guideKey`.
   */
  helpTab?: string;
  /**
   * For a page whose URL carries an id (`profiles/40225`): the pattern of its path. Such
   * a guide starts on the exact page the user opened the help center from, never on one
   * picked for them; without one, `route` (the list) is where they choose it.
   */
  pattern?: RegExp;
  /**
   * For a section opened by a query parameter (an /rh/admin card, `?tab=roles`): the
   * parameters the URL must carry, also added when the help center opens the page.
   */
  query?: Record<string, string>;
  /**
   * Theme the sub-page is filed under in the help center's section picker (`GUIDE.GROUPS.<group>`),
   * for a tab with many sub-pages (the /rh/admin cards).
   */
  group?: string;
}

/** A new page with a guide adds one line here. Sub-pages first: they are matched first. */
export const GUIDE_PAGES: GuidePageDef[] = [
  { guideKey: 'profile-new', labelKey: 'GUIDE.PAGES.PROFILE_NEW', icon: 'person_add', route: 'profiles', permissions: [],
    helpTab: 'profiles', pattern: /(^|\/)profiles\/user\/\d+$/ },
  { guideKey: 'profile-detail', labelKey: 'GUIDE.PAGES.PROFILE_DETAIL', icon: 'badge', route: 'profiles', permissions: [],
    helpTab: 'profiles', pattern: /(^|\/)profiles\/\d+$/ },
  { guideKey: 'candidate-list', labelKey: 'GUIDE.PAGES.CANDIDATE_LIST', icon: 'table_rows', route: 'candidates/list',
    permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE'], helpTab: 'candidates' },
  { guideKey: 'candidate-new', labelKey: 'GUIDE.PAGES.CANDIDATE_NEW', icon: 'person_add', route: 'candidates/new', permissions: ['CREATE_CANDIDATE'],
    helpTab: 'candidates' },
  { guideKey: 'candidate-detail', labelKey: 'GUIDE.PAGES.CANDIDATE_DETAIL', icon: 'contact_page', route: 'candidates',
    permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE'],
    helpTab: 'candidates', pattern: /(^|\/)candidates\/\d+$/ },
  // Before 'it-provisioning', whose route would also match these two.
  { guideKey: 'it-provisioning-history', labelKey: 'NAV.IT_PROVISIONING_HISTORY', icon: 'history', route: 'it-provisioning/historique', permissions: ['IT_PROVISIONING'],
    helpTab: 'it-provisioning' },
  { guideKey: 'it-provisioning-file', labelKey: 'GUIDE.PAGES.IT_FILE', icon: 'assignment', route: 'it-provisioning', permissions: ['IT_PROVISIONING'],
    helpTab: 'it-provisioning', pattern: /(^|\/)it-provisioning\/\d+$/ },
  { guideKey: 'onboarding-success', labelKey: 'GUIDE.PAGES.ONB_SUCCESS', icon: 'celebration', route: 'onboarding', permissions: ['HR_ONBOARDING'],
    helpTab: 'onboarding', pattern: /(^|\/)onboarding\/success$/ },
  { guideKey: 'onboarding-file', labelKey: 'GUIDE.PAGES.ONBOARDING_FILE', icon: 'assignment_ind', route: 'onboarding', permissions: ['HR_ONBOARDING'],
    helpTab: 'onboarding', pattern: /(^|\/)onboarding\/\d+$/ },
  { guideKey: 'offboarding-file', labelKey: 'GUIDE.PAGES.OFFBOARDING_FILE', icon: 'contact_page', route: 'offboarding',
    permissions: ['RH_MANAGE_OFFBOARDING', 'RH_VIEW_CONTRACTS', 'RH_MANAGE_LIFECYCLE'],
    helpTab: 'offboarding', pattern: /(^|\/)offboarding\/\d+$/ },
  { guideKey: 'conges-settle', labelKey: 'NAV.CONGES_SETTLE', icon: 'edit_calendar', route: 'conges/settle', permissions: ['SETTLE_LEAVES'],
    helpTab: 'conges-inbox' },
  { guideKey: 'conges-team', labelKey: 'NAV.CONGES_TEAM', icon: 'groups', route: 'conges/team', permissions: ['GET_EMPLOYEES_LEAVES'],
    helpTab: 'conges-inbox' },
  { guideKey: 'conges-global', labelKey: 'NAV.CONGES_GLOBAL', icon: 'public', route: 'conges/global', permissions: ['GET_GLOBAL_LEAVES'],
    helpTab: 'conges-inbox' },
  { guideKey: 'requests-inbox', labelKey: 'GUIDE.PAGES.REQ_INBOX', icon: 'move_to_inbox', route: 'requests/inbox', permissions: ['HR_UPDATE_PROFILE', 'HR_ADMIN_ROLES'],
    helpTab: 'requests' },
  { guideKey: 'request-detail', labelKey: 'GUIDE.PAGES.REQUEST_DETAIL', icon: 'description', route: 'requests', permissions: ['HR_UPDATE_PROFILE', 'HR_ADMIN_ROLES'],
    helpTab: 'requests', pattern: /(^|\/)requests\/\d+$/ },
  // A hiring request before the history, whose route would also match it.
  { guideKey: 'recruitment-demand', labelKey: 'GUIDE.PAGES.DEMAND_DETAIL', icon: 'work', route: 'requests-history',
    permissions: ['RH_VIEW_RECRUITMENT_DEMAND', 'RH_CREATE_RECRUITMENT_DEMAND', 'RH_APPROVE_RECRUITMENT_DEMAND'],
    helpTab: 'requests', pattern: /(^|\/)requests-history\/\d+$/ },
  { guideKey: 'requests-history', labelKey: 'NAV.REQUESTS_HISTORY', icon: 'history', route: 'requests-history',
    permissions: ['RH_VIEW_RECRUITMENT_DEMAND', 'RH_CREATE_RECRUITMENT_DEMAND', 'RH_APPROVE_RECRUITMENT_DEMAND'], helpTab: 'requests' },
  { guideKey: 'missions-history', labelKey: 'NAV.MISSIONS_HISTORY', icon: 'history', route: 'missions/historique', permissions: ['RH_CREATE_MISSION'],
    helpTab: 'missions' },
  // An /rh/admin card, before 'admin' whose route also matches it.
  { guideKey: 'admin-roles', labelKey: 'ADMIN.shell.tabs.roles', icon: 'admin_panel_settings', route: 'admin',
    permissions: ['GET_ROLES'], helpTab: 'admin', group: 'ACCESS', query: { tab: 'roles' } },
  { guideKey: 'admin-users', labelKey: 'ADMIN.shell.tabs.users', icon: 'person', route: 'admin',
    permissions: ['GET_USERS'], helpTab: 'admin', group: 'ACCESS', query: { tab: 'users' } },
  { guideKey: 'admin-parameters', labelKey: 'ADMIN.shell.tabs.parameters', icon: 'tune', route: 'admin',
    permissions: ['GET_PAYS'], helpTab: 'admin', group: 'DOCS', query: { tab: 'parameters' } },
  { guideKey: 'admin-holidays', labelKey: 'ADMIN.shell.tabs.holidays', icon: 'event', route: 'admin',
    permissions: ['GET_HOLIDAYS'], helpTab: 'admin', group: 'TIME', query: { tab: 'holidays' } },
  { guideKey: 'admin-absence-types', labelKey: 'ADMIN.shell.tabs.absenceTypes', icon: 'beach_access', route: 'admin',
    permissions: ['CREATE_ABSENCE_TYPE'], helpTab: 'admin', group: 'TIME', query: { tab: 'absence-types' } },
  { guideKey: 'admin-pays-calendar', labelKey: 'ADMIN.shell.tabs.paysCalendar', icon: 'calendar_month', route: 'admin',
    permissions: ['ADMIN_REGIMES'], helpTab: 'admin', group: 'TIME', query: { tab: 'pays-calendar' } },
  { guideKey: 'admin-request-types', labelKey: 'ADMIN.shell.tabs.requestTypes', icon: 'description', route: 'admin',
    permissions: ['GET_ROLES'], helpTab: 'admin', group: 'REQUESTS', query: { tab: 'request-types' } },
  { guideKey: 'admin-regimes', labelKey: 'ADMIN.shell.tabs.regimes', icon: 'schedule', route: 'admin',
    permissions: ['GET_ROLES'], helpTab: 'admin', group: 'TIME', query: { tab: 'regimes' } },
  { guideKey: 'admin-breaks', labelKey: 'ADMIN.shell.tabs.breaks', icon: 'free_breakfast', route: 'admin',
    permissions: ['ADMIN_BREAKS'], helpTab: 'admin', group: 'TIME', query: { tab: 'breaks' } },
  { guideKey: 'admin-overtime', labelKey: 'ADMIN.shell.tabs.overtime', icon: 'more_time', route: 'admin',
    permissions: ['GET_PAYS'], helpTab: 'admin', group: 'TIME', query: { tab: 'overtime' } },
  { guideKey: 'admin-lists', labelKey: 'ADMIN.shell.tabs.lists', icon: 'list_alt', route: 'admin',
    permissions: ['ADMIN_LISTS'], helpTab: 'admin', group: 'REQUESTS', query: { tab: 'lists' } },
  { guideKey: 'admin-ref-data', labelKey: 'ADMIN.shell.tabs.refData', icon: 'storage', route: 'admin',
    permissions: ['ADMIN_LISTS'], helpTab: 'admin', group: 'REQUESTS', query: { tab: 'ref-data' } },
  { guideKey: 'admin-notifications', labelKey: 'ADMIN.shell.tabs.notifications', icon: 'notifications', route: 'admin',
    permissions: ['ADMIN_NOTIFICATIONS'], helpTab: 'admin', group: 'DOCS', query: { tab: 'notifications' } },
  { guideKey: 'admin-interview-types', labelKey: 'ADMIN.shell.tabs.interviewTypes', icon: 'forum', route: 'admin',
    permissions: ['RH_ADMIN_INTERVIEW_TYPES'], helpTab: 'admin', group: 'REQUESTS', query: { tab: 'interview-types' } },
  { guideKey: 'admin-offboarding-catalog', labelKey: 'ADMIN.shell.tabs.offboardingCatalog', icon: 'logout', route: 'admin',
    permissions: ['RH_MANAGE_OFFBOARDING'], helpTab: 'admin', group: 'DOCS', query: { tab: 'offboarding-catalog' } },
  { guideKey: 'admin-document-templates', labelKey: 'ADMIN.shell.tabs.documentTemplates', icon: 'article', route: 'admin',
    permissions: ['HR_ADMIN_ROLES'], helpTab: 'admin', group: 'DOCS', query: { tab: 'document-templates' } },
  { guideKey: 'admin-sharepoint', labelKey: 'ADMIN.shell.tabs.sharepoint', icon: 'folder_shared', route: 'admin',
    permissions: ['ADMIN_SHAREPOINT'], helpTab: 'admin', group: 'DOCS', query: { tab: 'sharepoint' } },
  { guideKey: 'admin-contract-alerts', labelKey: 'ADMIN.shell.tabs.contractAlerts', icon: 'event_upcoming', route: 'admin',
    permissions: ['ADMIN_ROLES'], helpTab: 'admin', group: 'DOCS', query: { tab: 'contract-alerts' } },
  { guideKey: 'home', labelKey: 'NAV.ACCUEIL', icon: 'home', route: 'accueil', permissions: [] },
  { guideKey: 'profiles', labelKey: 'NAV.PROFILES', icon: 'account_circle', route: 'profiles', permissions: [] },
  { guideKey: 'recruitment', labelKey: 'NAV.PIPELINE', icon: 'analytics', route: 'recrutement', permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE'] },
  { guideKey: 'candidates', labelKey: 'NAV.CANDIDATES', icon: 'group_add', route: 'candidates', permissions: ['VIEW_CANDIDATES', 'HR_ONBOARDING', 'EDIT_CANDIDATE', 'CREATE_CANDIDATE'] },
  // Same order as the menu: « Provisioning IT » comes after « Candidats ».
  { guideKey: 'it-provisioning', labelKey: 'NAV.IT_PROVISIONING', icon: 'devices', route: 'it-provisioning', permissions: ['IT_PROVISIONING'] },
  { guideKey: 'onboarding', labelKey: 'NAV.ONBOARDING', icon: 'person_add', route: 'onboarding', permissions: ['HR_ONBOARDING'] },
  { guideKey: 'offboarding', labelKey: 'NAV.OFFBOARDING', icon: 'logout', route: 'offboarding',
    permissions: ['RH_MANAGE_OFFBOARDING', 'RH_VIEW_CONTRACTS', 'RH_MANAGE_LIFECYCLE'] },
  { guideKey: 'cdi-conversions', labelKey: 'NAV.CDI_CONVERSIONS', icon: 'workspace_premium', route: 'cdi-conversions',
    permissions: ['RH_REQUEST_CDI_CONVERSION', 'RH_VALIDATE_CDI_CONVERSION', 'RH_ARBITRATE_CDI_CONVERSION', 'RH_MANAGE_LIFECYCLE', 'RH_VIEW_CONTRACTS'] },
  { guideKey: 'missions', labelKey: 'NAV.MISSIONS', icon: 'flight_takeoff', route: 'missions', permissions: ['RH_CREATE_MISSION'] },
  { guideKey: 'billeterie', labelKey: 'NAV.BILLETERIE', icon: 'confirmation_number', route: 'billeterie', permissions: ['RH_MANAGE_MISSION_BILLETERIE'] },
  { guideKey: 'conges-inbox', labelKey: 'NAV.CONGES', icon: 'beach_access', route: 'conges/inbox', permissions: ['GET_LEAVES', 'RESPONSE_LEAVE'] },
  { guideKey: 'requests', labelKey: 'NAV.REQUESTS', icon: 'inbox', route: 'requests', permissions: ['HR_UPDATE_PROFILE', 'HR_ADMIN_ROLES'] },
  { guideKey: 'admin', labelKey: 'NAV.ADMIN', icon: 'admin_panel_settings', route: 'admin',
    permissions: ['ADMIN_ROLES', 'HR_ADMIN_ROLES', 'GET_ROLES', 'ADMIN_LISTS', 'ADMIN_REGIMES', 'ADMIN_BREAKS', 'ADMIN_NOTIFICATIONS', 'CREATE_ABSENCE_TYPE'] },
];

/** Help-center tab of a guide. */
export function helpTabOf(page: GuidePageDef): string {
  return page.helpTab ?? page.guideKey;
}

/** The guide of the page at `url` (an app URL, query string allowed), if it has one. */
export function guidePageAt(url: string): GuidePageDef | undefined {
  const [path, rest = ''] = url.split('?');
  const params = new URLSearchParams(rest.split('#')[0]);
  return GUIDE_PAGES.find(p =>
    (p.pattern ?? new RegExp(`(^|/)${p.route}(/|$)`)).test(path.split('#')[0])
    && Object.entries(p.query ?? {}).every(([k, v]) => params.get(k) === v));
}
