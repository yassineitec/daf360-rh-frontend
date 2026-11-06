/**
 * Content of the « Centre d'aide » (`rh-help-center`), per module page. Every text is an
 * i18n key (GUIDE.CENTER.* for the help center's own texts, HOME.GUIDE.* reused for the
 * documentation so a page's guide and its documentation never say two things).
 *
 * Filled in for the RH home page, the profiles directory, the profile file, the recruitment pipeline, the candidates board, the new-candidate form, the candidate file, IT provisioning, onboarding, offboarding, moves to CDI, missions, ticketing, leave, requests and administration; a new page adds its FAQ,
 * documentation and videos here, keyed by its `GUIDE_PAGES.guideKey`.
 */

export interface HelpFaq {
  id: string;
  questionKey: string;
  answerKey: string;
}

/** One section of a page's documentation: a title and its text. */
export interface HelpDocSection {
  titleKey: string;
  textKey: string;
}

export interface HelpVideo {
  titleKey: string;
  /** Shown as « 2 min ». */
  minutes: number;
  /**
   * Address of the video FILE (.mp4 / .webm), played in a `<video>` inside a modal — a
   * page link (a SharePoint or Stream viewer page) won't play there. Empty until the
   * video exists — the card then reads « Bientôt disponible ».
   */
  url: string;
}

export interface HelpPageContent {
  faq: HelpFaq[];
  docs: HelpDocSection[];
  videos: HelpVideo[];
}

export const HELP_CONTENT: Record<string, HelpPageContent> = {
  home: {
    faq: [
      { id: 'home-zero',     questionKey: 'GUIDE.CENTER.FAQ.HOME.ZERO.Q',     answerKey: 'GUIDE.CENTER.FAQ.HOME.ZERO.A' },
      { id: 'home-filter',   questionKey: 'GUIDE.CENTER.FAQ.HOME.FILTER.Q',   answerKey: 'GUIDE.CENTER.FAQ.HOME.FILTER.A' },
      { id: 'home-country',  questionKey: 'GUIDE.CENTER.FAQ.HOME.COUNTRY.Q',  answerKey: 'GUIDE.CENTER.FAQ.HOME.COUNTRY.A' },
      { id: 'home-docs',     questionKey: 'GUIDE.CENTER.FAQ.HOME.DOCS.Q',     answerKey: 'GUIDE.CENTER.FAQ.HOME.DOCS.A' },
      { id: 'home-shortcut', questionKey: 'GUIDE.CENTER.FAQ.HOME.SHORTCUT.Q', answerKey: 'GUIDE.CENTER.FAQ.HOME.SHORTCUT.A' },
      { id: 'home-probation', questionKey: 'GUIDE.CENTER.FAQ.HOME.PROBATION.Q', answerKey: 'GUIDE.CENTER.FAQ.HOME.PROBATION.A' },
      { id: 'home-newcomers', questionKey: 'GUIDE.CENTER.FAQ.HOME.NEWCOMERS.Q', answerKey: 'GUIDE.CENTER.FAQ.HOME.NEWCOMERS.A' },
      { id: 'home-completion', questionKey: 'GUIDE.CENTER.FAQ.HOME.COMPLETION.Q', answerKey: 'GUIDE.CENTER.FAQ.HOME.COMPLETION.A' },
    ],
    docs: [
      { titleKey: 'HOME.GUIDE.QUICK_ACTIONS.TITLE', textKey: 'HOME.GUIDE.QUICK_ACTIONS.TEXT' },
      { titleKey: 'HOME.GUIDE.MISSING_DOCS.TITLE',  textKey: 'HOME.GUIDE.MISSING_DOCS.TEXT' },
      { titleKey: 'HOME.GUIDE.PROBATION.TITLE',     textKey: 'HOME.GUIDE.PROBATION.TEXT' },
      { titleKey: 'HOME.GUIDE.WORKFORCE.TITLE',     textKey: 'HOME.GUIDE.WORKFORCE.TEXT' },
      { titleKey: 'HOME.GUIDE.COMPLETION.TITLE',    textKey: 'HOME.GUIDE.COMPLETION.TEXT' },
      { titleKey: 'HOME.GUIDE.JOINERS.TITLE',       textKey: 'HOME.GUIDE.JOINERS.TEXT' },
    ],
    videos: [
      // TEST ONLY: a local recording served by the RH dev server (absolute URL — a relative
      // one would resolve against the shell on 4200). Replace with its SharePoint/Stream
      // link and delete public/assets/videos/ before any deployment.
      { titleKey: 'GUIDE.CENTER.VIDEOS.HOME_TOUR', minutes: 1, url: 'http://localhost:4203/assets/videos/accueil-rh.mp4' },
    ],
  },
  profiles: {
    faq: [
      { id: 'profiles-left',     questionKey: 'GUIDE.CENTER.FAQ.PROFILES.LEFT.Q',     answerKey: 'GUIDE.CENTER.FAQ.PROFILES.LEFT.A' },
      { id: 'profiles-counters', questionKey: 'GUIDE.CENTER.FAQ.PROFILES.COUNTERS.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILES.COUNTERS.A' },
      { id: 'profiles-edit',     questionKey: 'GUIDE.CENTER.FAQ.PROFILES.EDIT.Q',     answerKey: 'GUIDE.CENTER.FAQ.PROFILES.EDIT.A' },
      { id: 'profiles-nofile',   questionKey: 'GUIDE.CENTER.FAQ.PROFILES.NO_FILE.Q',  answerKey: 'GUIDE.CENTER.FAQ.PROFILES.NO_FILE.A' },
      { id: 'profiles-export',   questionKey: 'GUIDE.CENTER.FAQ.PROFILES.EXPORT.Q',   answerKey: 'GUIDE.CENTER.FAQ.PROFILES.EXPORT.A' },
      { id: 'profiles-memory',   questionKey: 'GUIDE.CENTER.FAQ.PROFILES.MEMORY.Q',   answerKey: 'GUIDE.CENTER.FAQ.PROFILES.MEMORY.A' },
      { id: 'profiles-create', questionKey: 'GUIDE.CENTER.FAQ.PROFILES.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILES.CREATE.A' },
      { id: 'profiles-new-hidden', questionKey: 'GUIDE.CENTER.FAQ.PROFILES.NEW_HIDDEN.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILES.NEW_HIDDEN.A' },
      { id: 'profiles-email', questionKey: 'GUIDE.CENTER.FAQ.PROFILES.EMAIL.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILES.EMAIL.A' },
    ],
    docs: [
      { titleKey: 'PROFILES.GUIDE.KPIS.TITLE',       textKey: 'PROFILES.GUIDE.KPIS.TEXT' },
      { titleKey: 'PROFILES.GUIDE.SEARCH.TITLE',     textKey: 'PROFILES.GUIDE.SEARCH.TEXT' },
      { titleKey: 'PROFILES.GUIDE.LIST.TITLE',       textKey: 'PROFILES.GUIDE.LIST.TEXT' },
      { titleKey: 'PROFILES.GUIDE.SELECTION.TITLE',  textKey: 'PROFILES.GUIDE.SELECTION.TEXT' },
      { titleKey: 'PROFILES.GUIDE.PAGINATION.TITLE', textKey: 'PROFILES.GUIDE.PAGINATION.TEXT' },
    ],
    // No video yet — none is listed rather than a « Bientôt disponible » placeholder.
    videos: [],
  },
  // The profile file — listed under the « Profils » tab (`helpTab` in guide-pages.ts).
  'profile-detail': {
    faq: [
      { id: 'profile-detail-bank', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.BANK_TAB.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.BANK_TAB.A' },
      { id: 'profile-detail-save', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.SAVE.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.SAVE.A' },
      { id: 'profile-detail-lost', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.LOST.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.LOST.A' },
      { id: 'profile-detail-salary', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.SALARY.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.SALARY.A' },
      { id: 'profile-detail-attestation', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.ATTESTATION.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.ATTESTATION.A' },
      { id: 'profile-detail-disabled', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.DISABLED.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.DISABLED.A' },
      { id: 'profile-detail-contract', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.CONTRACT.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.CONTRACT.A' },
      { id: 'profile-detail-offboarding', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.OFFBOARDING.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.OFFBOARDING.A' },
      { id: 'profile-detail-status', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.STATUS.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.STATUS.A' },
      { id: 'profile-detail-photo', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.PHOTO.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.PHOTO.A' },
      { id: 'profile-detail-document', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.DOCUMENT.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.DOCUMENT.A' },
      { id: 'profile-detail-new-contract', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.NEW_CONTRACT.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.NEW_CONTRACT.A' },
      { id: 'profile-detail-it', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.IT.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_DETAIL.IT.A' },
    ],
    docs: [
      { titleKey: 'PROFILES.DETAIL_GUIDE.IDENTITY.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.IDENTITY.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.ACTIONS.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.ACTIONS.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.EDIT.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.EDIT.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.EMPLOI.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.EMPLOI.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.CONTACT.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.CONTACT.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.BANK.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.BANK.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.CONTRACTS.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.CONTRACTS.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.IT_ASSETS.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.IT_ASSETS.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.DOCUMENTS.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.DOCUMENTS.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.REMUNERATION.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.REMUNERATION.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.DOC_HISTORY.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.DOC_HISTORY.TEXT' },
      { titleKey: 'PROFILES.DETAIL_GUIDE.DRAWER.TITLE', textKey: 'PROFILES.DETAIL_GUIDE.DRAWER.TEXT' },
    ],
    videos: [],
  },
  recruitment: {
    faq: [
      { id: 'recruitment-create', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.CREATE.A' },
      { id: 'recruitment-move', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.MOVE.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.MOVE.A' },
      { id: 'recruitment-refused', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.REFUSED.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.REFUSED.A' },
      { id: 'recruitment-accept', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.ACCEPT.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.ACCEPT.A' },
      { id: 'recruitment-counters', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.COUNTERS.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.COUNTERS.A' },
      { id: 'recruitment-offboarding', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.OFFBOARDING.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.OFFBOARDING.A' },
      { id: 'recruitment-memory', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.MEMORY.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.MEMORY.A' },
      { id: 'recruitment-reject', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.REJECT.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.REJECT.A' },
      { id: 'recruitment-hire', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.HIRE.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.HIRE.A' },
      { id: 'recruitment-demand', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.DEMAND.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.DEMAND.A' },
      { id: 'recruitment-view', questionKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.VIEW.Q', answerKey: 'GUIDE.CENTER.FAQ.RECRUITMENT.VIEW.A' },
    ],
    docs: [
      { titleKey: 'RECRUITMENT.GUIDE.KPIS.TITLE', textKey: 'RECRUITMENT.GUIDE.KPIS.TEXT' },
      { titleKey: 'RECRUITMENT.GUIDE.TOOLBAR.TITLE', textKey: 'RECRUITMENT.GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'RECRUITMENT.GUIDE.BOARD.TITLE', textKey: 'RECRUITMENT.GUIDE.BOARD.TEXT' },
      { titleKey: 'RECRUITMENT.GUIDE.MOVES.TITLE', textKey: 'RECRUITMENT.GUIDE.MOVES.TEXT' },
      { titleKey: 'RECRUITMENT.GUIDE.ACTIONS.TITLE', textKey: 'RECRUITMENT.GUIDE.ACTIONS.TEXT' },
      { titleKey: 'RECRUITMENT.GUIDE.INSIGHTS.TITLE', textKey: 'RECRUITMENT.GUIDE.INSIGHTS.TEXT' },
    ],
    videos: [],
  },
  // /rh/candidates — the Préqualification → Recruté board (PipelineComponent).
  candidates: {
    faq: [
      { id: 'candidates-create', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATES.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATES.CREATE.A' },
      { id: 'candidates-difference', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATES.DIFFERENCE.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATES.DIFFERENCE.A' },
      { id: 'candidates-rejected', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATES.REJECTED.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATES.REJECTED.A' },
      { id: 'candidates-interview', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATES.INTERVIEW.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATES.INTERVIEW.A' },
      { id: 'candidates-offer', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATES.OFFER.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATES.OFFER.A' },
      { id: 'candidates-answer', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATES.ANSWER.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATES.ANSWER.A' },
      { id: 'candidates-urgent', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATES.URGENT.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATES.URGENT.A' },
      { id: 'candidates-delay', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATES.DELAY.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATES.DELAY.A' },
      { id: 'candidates-sort', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATES.SORT.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATES.SORT.A' },
      { id: 'candidates-memory', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATES.MEMORY.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATES.MEMORY.A' },
    ],
    docs: [
      { titleKey: 'CANDIDATES_BOARD.GUIDE.KPIS.TITLE', textKey: 'CANDIDATES_BOARD.GUIDE.KPIS.TEXT' },
      { titleKey: 'CANDIDATES_BOARD.GUIDE.TOOLBAR.TITLE', textKey: 'CANDIDATES_BOARD.GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'CANDIDATES_BOARD.GUIDE.BOARD.TITLE', textKey: 'CANDIDATES_BOARD.GUIDE.BOARD.TEXT' },
      { titleKey: 'CANDIDATES_BOARD.GUIDE.ACTIONS.TITLE', textKey: 'CANDIDATES_BOARD.GUIDE.ACTIONS.TEXT' },
    ],
    videos: [],
  },
  // /rh/candidates/new — listed under the « Candidats » tab (`helpTab` in guide-pages.ts).
  'candidate-new': {
    faq: [
      { id: 'candidate-new-required', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.REQUIRED.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.REQUIRED.A' },
      { id: 'candidate-new-next', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.NEXT.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.NEXT.A' },
      { id: 'candidate-new-demand', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.DEMAND.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.DEMAND.A' },
      { id: 'candidate-new-cv', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.CV.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.CV.A' },
      { id: 'candidate-new-salary', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.SALARY.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.SALARY.A' },
      { id: 'candidate-new-nationality', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.NATIONALITY.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.NATIONALITY.A' },
      { id: 'candidate-new-quality', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.QUALITY.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.QUALITY.A' },
      { id: 'candidate-new-saved', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.SAVED.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.SAVED.A' },
      { id: 'candidate-new-after', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.AFTER.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_NEW.AFTER.A' },
    ],
    docs: [
      { titleKey: 'CANDIDATE_FORM.GUIDE.IDENTITY.TITLE', textKey: 'CANDIDATE_FORM.GUIDE.IDENTITY.TEXT' },
      { titleKey: 'CANDIDATE_FORM.GUIDE.POSITION.TITLE', textKey: 'CANDIDATE_FORM.GUIDE.POSITION.TEXT' },
      { titleKey: 'CANDIDATE_FORM.GUIDE.CV_NOTES.TITLE', textKey: 'CANDIDATE_FORM.GUIDE.CV_NOTES.TEXT' },
      { titleKey: 'CANDIDATE_FORM.GUIDE.PROGRESS.TITLE', textKey: 'CANDIDATE_FORM.GUIDE.PROGRESS.TEXT' },
      { titleKey: 'CANDIDATE_FORM.GUIDE.ACTIONS.TITLE', textKey: 'CANDIDATE_FORM.GUIDE.ACTIONS.TEXT' },
    ],
    videos: [],
  },
  // /rh/candidates/:id — listed under the « Candidats » tab (`helpTab` in guide-pages.ts).
  'candidate-detail': {
    faq: [
      { id: 'candidate-detail-accept', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.ACCEPT.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.ACCEPT.A' },
      { id: 'candidate-detail-edit', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.EDIT.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.EDIT.A' },
      { id: 'candidate-detail-tabs', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.TABS.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.TABS.A' },
      { id: 'candidate-detail-interview-result', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.INTERVIEW_RESULT.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.INTERVIEW_RESULT.A' },
      { id: 'candidate-detail-offer-steps', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.OFFER_STEPS.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.OFFER_STEPS.A' },
      { id: 'candidate-detail-send-blocked', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.SEND_BLOCKED.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.SEND_BLOCKED.A' },
      { id: 'candidate-detail-hire', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.HIRE.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.HIRE.A' },
      { id: 'candidate-detail-cv', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.CV.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.CV.A' },
      { id: 'candidate-detail-salary-tab', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.SALARY_TAB.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.SALARY_TAB.A' },
      { id: 'candidate-detail-it', questionKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.IT.Q', answerKey: 'GUIDE.CENTER.FAQ.CANDIDATE_DETAIL.IT.A' },
    ],
    docs: [
      { titleKey: 'CANDIDATE_DETAIL.GUIDE.HEADER.TITLE', textKey: 'CANDIDATE_DETAIL.GUIDE.HEADER.TEXT' },
      { titleKey: 'CANDIDATE_DETAIL.GUIDE.IDENTITY.TITLE', textKey: 'CANDIDATE_DETAIL.GUIDE.IDENTITY.TEXT' },
      { titleKey: 'CANDIDATE_DETAIL.GUIDE.RAIL.TITLE', textKey: 'CANDIDATE_DETAIL.GUIDE.RAIL.TEXT' },
      { titleKey: 'CANDIDATE_DETAIL.GUIDE.PROFILE.TITLE', textKey: 'CANDIDATE_DETAIL.GUIDE.PROFILE.TEXT' },
      { titleKey: 'CANDIDATE_DETAIL.GUIDE.SALARY.TITLE', textKey: 'CANDIDATE_DETAIL.GUIDE.SALARY.TEXT' },
      { titleKey: 'CANDIDATE_DETAIL.GUIDE.INTERVIEWS.TITLE', textKey: 'CANDIDATE_DETAIL.GUIDE.INTERVIEWS.TEXT' },
      { titleKey: 'CANDIDATE_DETAIL.GUIDE.OFFER.TITLE', textKey: 'CANDIDATE_DETAIL.GUIDE.OFFER.TEXT' },
      { titleKey: 'CANDIDATE_DETAIL.GUIDE.CV.TITLE', textKey: 'CANDIDATE_DETAIL.GUIDE.CV.TEXT' },
      { titleKey: 'CANDIDATE_DETAIL.GUIDE.IT.TITLE', textKey: 'CANDIDATE_DETAIL.GUIDE.IT.TEXT' },
    ],
    videos: [],
  },
  // /rh/it-provisioning — the open IT files.
  'it-provisioning': {
    faq: [
      { id: 'it-provisioning-origin', questionKey: 'GUIDE.CENTER.FAQ.IT_LIST.ORIGIN.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_LIST.ORIGIN.A' },
      { id: 'it-provisioning-open', questionKey: 'GUIDE.CENTER.FAQ.IT_LIST.OPEN.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_LIST.OPEN.A' },
      { id: 'it-provisioning-overdue', questionKey: 'GUIDE.CENTER.FAQ.IT_LIST.OVERDUE.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_LIST.OVERDUE.A' },
      { id: 'it-provisioning-incomplete', questionKey: 'GUIDE.CENTER.FAQ.IT_LIST.INCOMPLETE.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_LIST.INCOMPLETE.A' },
      { id: 'it-provisioning-missing', questionKey: 'GUIDE.CENTER.FAQ.IT_LIST.MISSING.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_LIST.MISSING.A' },
      { id: 'it-provisioning-done', questionKey: 'GUIDE.CENTER.FAQ.IT_LIST.DONE.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_LIST.DONE.A' },
      { id: 'it-provisioning-memory', questionKey: 'GUIDE.CENTER.FAQ.IT_LIST.MEMORY.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_LIST.MEMORY.A' },
    ],
    docs: [
      { titleKey: 'IT_GUIDE.LIST.KPIS.TITLE', textKey: 'IT_GUIDE.LIST.KPIS.TEXT' },
      { titleKey: 'IT_GUIDE.LIST.TOOLBAR.TITLE', textKey: 'IT_GUIDE.LIST.TOOLBAR.TEXT' },
      { titleKey: 'IT_GUIDE.LIST.ITEMS.TITLE', textKey: 'IT_GUIDE.LIST.ITEMS.TEXT' },
    ],
    videos: [],
  },
  // /rh/it-provisioning/historique — listed under « Provisioning IT ».
  'it-provisioning-history': {
    faq: [
      { id: 'it-provisioning-history-what', questionKey: 'GUIDE.CENTER.FAQ.IT_HISTORY.WHAT.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_HISTORY.WHAT.A' },
      { id: 'it-provisioning-history-avg', questionKey: 'GUIDE.CENTER.FAQ.IT_HISTORY.AVG.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_HISTORY.AVG.A' },
      { id: 'it-provisioning-history-edit', questionKey: 'GUIDE.CENTER.FAQ.IT_HISTORY.EDIT.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_HISTORY.EDIT.A' },
    ],
    docs: [
      { titleKey: 'IT_GUIDE.HISTORY.KPIS.TITLE', textKey: 'IT_GUIDE.HISTORY.KPIS.TEXT' },
      { titleKey: 'IT_GUIDE.HISTORY.TOOLBAR.TITLE', textKey: 'IT_GUIDE.HISTORY.TOOLBAR.TEXT' },
      { titleKey: 'IT_GUIDE.HISTORY.ITEMS.TITLE', textKey: 'IT_GUIDE.HISTORY.ITEMS.TEXT' },
    ],
    videos: [],
  },
  // /rh/it-provisioning/:id — listed under « Provisioning IT ».
  'it-provisioning-file': {
    faq: [
      { id: 'it-provisioning-file-order', questionKey: 'GUIDE.CENTER.FAQ.IT_FILE.ORDER.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_FILE.ORDER.A' },
      { id: 'it-provisioning-file-save', questionKey: 'GUIDE.CENTER.FAQ.IT_FILE.SAVE.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_FILE.SAVE.A' },
      { id: 'it-provisioning-file-email', questionKey: 'GUIDE.CENTER.FAQ.IT_FILE.EMAIL.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_FILE.EMAIL.A' },
      { id: 'it-provisioning-file-email-wrong', questionKey: 'GUIDE.CENTER.FAQ.IT_FILE.EMAIL_WRONG.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_FILE.EMAIL_WRONG.A' },
      { id: 'it-provisioning-file-hardware', questionKey: 'GUIDE.CENTER.FAQ.IT_FILE.HARDWARE.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_FILE.HARDWARE.A' },
      { id: 'it-provisioning-file-no-hardware', questionKey: 'GUIDE.CENTER.FAQ.IT_FILE.NO_HARDWARE.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_FILE.NO_HARDWARE.A' },
      { id: 'it-provisioning-file-complete-disabled', questionKey: 'GUIDE.CENTER.FAQ.IT_FILE.COMPLETE_DISABLED.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_FILE.COMPLETE_DISABLED.A' },
      { id: 'it-provisioning-file-complete', questionKey: 'GUIDE.CENTER.FAQ.IT_FILE.COMPLETE.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_FILE.COMPLETE.A' },
      { id: 'it-provisioning-file-discharge', questionKey: 'GUIDE.CENTER.FAQ.IT_FILE.DISCHARGE.Q', answerKey: 'GUIDE.CENTER.FAQ.IT_FILE.DISCHARGE.A' },
    ],
    docs: [
      { titleKey: 'IT_GUIDE.FILE.PROGRESS.TITLE', textKey: 'IT_GUIDE.FILE.PROGRESS.TEXT' },
      { titleKey: 'IT_GUIDE.FILE.IDENTITY.TITLE', textKey: 'IT_GUIDE.FILE.IDENTITY.TEXT' },
      { titleKey: 'IT_GUIDE.FILE.MS365.TITLE', textKey: 'IT_GUIDE.FILE.MS365.TEXT' },
      { titleKey: 'IT_GUIDE.FILE.HARDWARE.TITLE', textKey: 'IT_GUIDE.FILE.HARDWARE.TEXT' },
      { titleKey: 'IT_GUIDE.FILE.LICENSES.TITLE', textKey: 'IT_GUIDE.FILE.LICENSES.TEXT' },
      { titleKey: 'IT_GUIDE.FILE.AD.TITLE', textKey: 'IT_GUIDE.FILE.AD.TEXT' },
      { titleKey: 'IT_GUIDE.FILE.NOTES.TITLE', textKey: 'IT_GUIDE.FILE.NOTES.TEXT' },
      { titleKey: 'IT_GUIDE.FILE.ACTIONS.TITLE', textKey: 'IT_GUIDE.FILE.ACTIONS.TEXT' },
    ],
    videos: [],
  },
  // /rh/onboarding — the employees waiting for their HR profile.
  'onboarding': {
    faq: [
      { id: 'onboarding-origin', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.ORIGIN.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.ORIGIN.A' },
      { id: 'onboarding-open', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.OPEN.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.OPEN.A' },
      { id: 'onboarding-draft', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.DRAFT.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.DRAFT.A' },
      { id: 'onboarding-late', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.LATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.LATE.A' },
      { id: 'onboarding-time', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.TIME.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.TIME.A' },
      { id: 'onboarding-done', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.DONE.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.DONE.A' },
      { id: 'onboarding-memory', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.MEMORY.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_LIST.MEMORY.A' },
    ],
    docs: [
      { titleKey: 'ONBOARDING_GUIDE.LIST.KPIS.TITLE', textKey: 'ONBOARDING_GUIDE.LIST.KPIS.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.LIST.TOOLBAR.TITLE', textKey: 'ONBOARDING_GUIDE.LIST.TOOLBAR.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.LIST.ITEMS.TITLE', textKey: 'ONBOARDING_GUIDE.LIST.ITEMS.TEXT' },
    ],
    videos: [],
  },
  // /rh/onboarding/:candidateId — listed under « Onboarding ».
  'onboarding-file': {
    faq: [
      { id: 'onboarding-file-required', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.REQUIRED.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.REQUIRED.A' },
      { id: 'onboarding-file-draft', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.DRAFT.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.DRAFT.A' },
      { id: 'onboarding-file-certificate', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.CERTIFICATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.CERTIFICATE.A' },
      { id: 'onboarding-file-contract', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.CONTRACT.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.CONTRACT.A' },
      { id: 'onboarding-file-salary', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.SALARY.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.SALARY.A' },
      { id: 'onboarding-file-readonly', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.READONLY.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.READONLY.A' },
      { id: 'onboarding-file-photo', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.PHOTO.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.PHOTO.A' },
      { id: 'onboarding-file-submit', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.SUBMIT.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.SUBMIT.A' },
      { id: 'onboarding-file-upload-failed', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.UPLOAD_FAILED.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.UPLOAD_FAILED.A' },
      { id: 'onboarding-file-no-regime', questionKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.NO_REGIME.Q', answerKey: 'GUIDE.CENTER.FAQ.ONBOARDING_FILE.NO_REGIME.A' },
    ],
    docs: [
      { titleKey: 'ONBOARDING_GUIDE.FILE.CARD.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.CARD.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.FILE.STEPPER.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.STEPPER.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.FILE.IDENTITY.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.IDENTITY.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.FILE.POSITION.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.POSITION.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.FILE.CONTRACT.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.CONTRACT.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.FILE.REGIME.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.REGIME.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.FILE.PERSONAL.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.PERSONAL.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.FILE.BANK.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.BANK.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.FILE.EMERGENCY.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.EMERGENCY.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.FILE.SUMMARY.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.SUMMARY.TEXT' },
      { titleKey: 'ONBOARDING_GUIDE.FILE.ACTIONS.TITLE', textKey: 'ONBOARDING_GUIDE.FILE.ACTIONS.TEXT' },
    ],
    videos: [],
  },
  // /rh/offboarding (and its per-reason pages) — the departures.
  'offboarding': {
    faq: [
      { id: 'offboarding-start', questionKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.START.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.START.A' },
      { id: 'offboarding-columns', questionKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.COLUMNS.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.COLUMNS.A' },
      { id: 'offboarding-blocked', questionKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.BLOCKED.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.BLOCKED.A' },
      { id: 'offboarding-sla', questionKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.SLA.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.SLA.A' },
      { id: 'offboarding-resignation', questionKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.RESIGNATION.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.RESIGNATION.A' },
      { id: 'offboarding-memory', questionKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.MEMORY.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_LIST.MEMORY.A' },
    ],
    docs: [
      { titleKey: 'OFFBOARDING_GUIDE.LIST.KPIS.TITLE', textKey: 'OFFBOARDING_GUIDE.LIST.KPIS.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.LIST.TOOLBAR.TITLE', textKey: 'OFFBOARDING_GUIDE.LIST.TOOLBAR.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.LIST.BOARD.TITLE', textKey: 'OFFBOARDING_GUIDE.LIST.BOARD.TEXT' },
    ],
    videos: [],
  },
  // /rh/offboarding/:id — listed under « Offboarding ».
  'offboarding-file': {
    faq: [
      { id: 'offboarding-file-locked', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.LOCKED.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.LOCKED.A' },
      { id: 'offboarding-file-reserved', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.RESERVED.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.RESERVED.A' },
      { id: 'offboarding-file-task', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.TASK.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.TASK.A' },
      { id: 'offboarding-file-last-day', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.LAST_DAY.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.LAST_DAY.A' },
      { id: 'offboarding-file-validation', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.VALIDATION.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.VALIDATION.A' },
      { id: 'offboarding-file-handover', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.HANDOVER.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.HANDOVER.A' },
      { id: 'offboarding-file-assets', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.ASSETS.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.ASSETS.A' },
      { id: 'offboarding-file-exit-interview', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.EXIT_INTERVIEW.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.EXIT_INTERVIEW.A' },
      { id: 'offboarding-file-settlement', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.SETTLEMENT.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.SETTLEMENT.A' },
      { id: 'offboarding-file-close', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.CLOSE.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.CLOSE.A' },
      { id: 'offboarding-file-cancel', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.CANCEL.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.CANCEL.A' },
      { id: 'offboarding-file-reopen', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.REOPEN.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.REOPEN.A' },
      { id: 'offboarding-file-history', questionKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.HISTORY.Q', answerKey: 'GUIDE.CENTER.FAQ.OFFB_FILE.HISTORY.A' },
    ],
    docs: [
      { titleKey: 'OFFBOARDING_GUIDE.FILE.HEADER.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.HEADER.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.FILE.CARD.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.CARD.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.FILE.RAIL.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.RAIL.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.FILE.DECLARATION.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.DECLARATION.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.FILE.VALIDATION.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.VALIDATION.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.FILE.HANDOVER.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.HANDOVER.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.FILE.IT_ASSETS.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.IT_ASSETS.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.FILE.HR_DOCS.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.HR_DOCS.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.FILE.PAYROLL.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.PAYROLL.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.FILE.CLOSURE.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.CLOSURE.TEXT' },
      { titleKey: 'OFFBOARDING_GUIDE.FILE.BAR.TITLE', textKey: 'OFFBOARDING_GUIDE.FILE.BAR.TEXT' },
    ],
    videos: [],
  },
  // /rh/conges/inbox — the leave requests waiting for a decision (« Congés » tab).
  'conges-inbox': {
    faq: [
      { id: 'conges-inbox-approve', questionKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.APPROVE.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.APPROVE.A' },
      { id: 'conges-inbox-refuse', questionKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.REFUSE.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.REFUSE.A' },
      { id: 'conges-inbox-bulk', questionKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.BULK.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.BULK.A' },
      { id: 'conges-inbox-balance', questionKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.BALANCE.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.BALANCE.A' },
      { id: 'conges-inbox-missing', questionKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.MISSING.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.MISSING.A' },
      { id: 'conges-inbox-undo', questionKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.UNDO.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.UNDO.A' },
      { id: 'conges-inbox-days', questionKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.DAYS.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.DAYS.A' },
      { id: 'conges-inbox-own', questionKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.OWN.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_INBOX.OWN.A' },
    ],
    docs: [
      { titleKey: 'CONGES_GUIDE.INBOX.KPIS.TITLE', textKey: 'CONGES_GUIDE.INBOX.KPIS.TEXT' },
      { titleKey: 'CONGES_GUIDE.INBOX.TOOLBAR.TITLE', textKey: 'CONGES_GUIDE.INBOX.TOOLBAR.TEXT' },
      { titleKey: 'CONGES_GUIDE.INBOX.ITEMS.TITLE', textKey: 'CONGES_GUIDE.INBOX.ITEMS.TEXT' },
    ],
    videos: [],
  },
  // /rh/conges/settle — listed under « Congés ».
  'conges-settle': {
    faq: [
      { id: 'conges-settle-how', questionKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.HOW.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.HOW.A' },
      { id: 'conges-settle-approval', questionKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.APPROVAL.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.APPROVAL.A' },
      { id: 'conges-settle-proof', questionKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.PROOF.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.PROOF.A' },
      { id: 'conges-settle-calendar', questionKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.CALENDAR.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.CALENDAR.A' },
      { id: 'conges-settle-no-approver', questionKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.NO_APPROVER.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.NO_APPROVER.A' },
      { id: 'conges-settle-mine', questionKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.MINE.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_SETTLE.MINE.A' },
    ],
    docs: [
      { titleKey: 'CONGES_GUIDE.SETTLE.NEW.TITLE', textKey: 'CONGES_GUIDE.SETTLE.NEW.TEXT' },
      { titleKey: 'CONGES_GUIDE.SETTLE.KPIS.TITLE', textKey: 'CONGES_GUIDE.SETTLE.KPIS.TEXT' },
      { titleKey: 'CONGES_GUIDE.SETTLE.TOOLBAR.TITLE', textKey: 'CONGES_GUIDE.SETTLE.TOOLBAR.TEXT' },
      { titleKey: 'CONGES_GUIDE.SETTLE.ITEMS.TITLE', textKey: 'CONGES_GUIDE.SETTLE.ITEMS.TEXT' },
    ],
    videos: [],
  },
  // /rh/conges/team — listed under « Congés ».
  'conges-team': {
    faq: [
      { id: 'conges-team-who', questionKey: 'GUIDE.CENTER.FAQ.CONGES_TEAM.WHO.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_TEAM.WHO.A' },
      { id: 'conges-team-states', questionKey: 'GUIDE.CENTER.FAQ.CONGES_TEAM.STATES.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_TEAM.STATES.A' },
      { id: 'conges-team-proof', questionKey: 'GUIDE.CENTER.FAQ.CONGES_TEAM.PROOF.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_TEAM.PROOF.A' },
    ],
    docs: [
      { titleKey: 'CONGES_GUIDE.TEAM.KPIS.TITLE', textKey: 'CONGES_GUIDE.TEAM.KPIS.TEXT' },
      { titleKey: 'CONGES_GUIDE.TEAM.TOOLBAR.TITLE', textKey: 'CONGES_GUIDE.TEAM.TOOLBAR.TEXT' },
      { titleKey: 'CONGES_GUIDE.TEAM.ITEMS.TITLE', textKey: 'CONGES_GUIDE.TEAM.ITEMS.TEXT' },
    ],
    videos: [],
  },
  // /rh/conges/global — listed under « Congés ».
  'conges-global': {
    faq: [
      { id: 'conges-global-who', questionKey: 'GUIDE.CENTER.FAQ.CONGES_GLOBAL.WHO.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_GLOBAL.WHO.A' },
      { id: 'conges-global-archive', questionKey: 'GUIDE.CENTER.FAQ.CONGES_GLOBAL.ARCHIVE.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_GLOBAL.ARCHIVE.A' },
      { id: 'conges-global-types', questionKey: 'GUIDE.CENTER.FAQ.CONGES_GLOBAL.TYPES.Q', answerKey: 'GUIDE.CENTER.FAQ.CONGES_GLOBAL.TYPES.A' },
    ],
    docs: [
      { titleKey: 'CONGES_GUIDE.GLOBAL.KPIS.TITLE', textKey: 'CONGES_GUIDE.GLOBAL.KPIS.TEXT' },
      { titleKey: 'CONGES_GUIDE.GLOBAL.TOOLBAR.TITLE', textKey: 'CONGES_GUIDE.GLOBAL.TOOLBAR.TEXT' },
      { titleKey: 'CONGES_GUIDE.GLOBAL.ITEMS.TITLE', textKey: 'CONGES_GUIDE.GLOBAL.ITEMS.TEXT' },
    ],
    videos: [],
  },
  // /rh/requests — the open HR requests (« Demandes » tab).
  'requests': {
    faq: [
      { id: 'requests-what', questionKey: 'GUIDE.CENTER.FAQ.REQ_LIST.WHAT.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_LIST.WHAT.A' },
      { id: 'requests-new', questionKey: 'GUIDE.CENTER.FAQ.REQ_LIST.NEW.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_LIST.NEW.A' },
      { id: 'requests-urgency', questionKey: 'GUIDE.CENTER.FAQ.REQ_LIST.URGENCY.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_LIST.URGENCY.A' },
      { id: 'requests-approve', questionKey: 'GUIDE.CENTER.FAQ.REQ_LIST.APPROVE.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_LIST.APPROVE.A' },
      { id: 'requests-refuse', questionKey: 'GUIDE.CENTER.FAQ.REQ_LIST.REFUSE.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_LIST.REFUSE.A' },
      { id: 'requests-cancel', questionKey: 'GUIDE.CENTER.FAQ.REQ_LIST.CANCEL.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_LIST.CANCEL.A' },
      { id: 'requests-statuses', questionKey: 'GUIDE.CENTER.FAQ.REQ_LIST.STATUSES.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_LIST.STATUSES.A' },
      { id: 'requests-recruit-validate', questionKey: 'GUIDE.CENTER.FAQ.REQ_LIST.RECRUIT_VALIDATE.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_LIST.RECRUIT_VALIDATE.A' },
      { id: 'requests-memory', questionKey: 'GUIDE.CENTER.FAQ.REQ_LIST.MEMORY.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_LIST.MEMORY.A' },
    ],
    docs: [
      { titleKey: 'REQUESTS_GUIDE.LIST.KPIS.TITLE', textKey: 'REQUESTS_GUIDE.LIST.KPIS.TEXT' },
      { titleKey: 'REQUESTS_GUIDE.LIST.TOOLBAR.TITLE', textKey: 'REQUESTS_GUIDE.LIST.TOOLBAR.TEXT' },
      { titleKey: 'REQUESTS_GUIDE.LIST.ITEMS.TITLE', textKey: 'REQUESTS_GUIDE.LIST.ITEMS.TEXT' },
      { titleKey: 'REQUESTS_GUIDE.LIST.RECRUITMENT.TITLE', textKey: 'REQUESTS_GUIDE.LIST.RECRUITMENT.TEXT' },
    ],
    videos: [],
  },
  // /rh/requests/:id — listed under « Demandes ».
  'request-detail': {
    faq: [
      { id: 'request-detail-decide', questionKey: 'GUIDE.CENTER.FAQ.REQ_DETAIL.DECIDE.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_DETAIL.DECIDE.A' },
      { id: 'request-detail-l2', questionKey: 'GUIDE.CENTER.FAQ.REQ_DETAIL.L2.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_DETAIL.L2.A' },
      { id: 'request-detail-docs', questionKey: 'GUIDE.CENTER.FAQ.REQ_DETAIL.DOCS.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_DETAIL.DOCS.A' },
    ],
    docs: [
      { titleKey: 'REQUESTS_GUIDE.DETAIL.HEADER.TITLE', textKey: 'REQUESTS_GUIDE.DETAIL.HEADER.TEXT' },
      { titleKey: 'REQUESTS_GUIDE.DETAIL.ACTION.TITLE', textKey: 'REQUESTS_GUIDE.DETAIL.ACTION.TEXT' },
      { titleKey: 'REQUESTS_GUIDE.DETAIL.CONTENT.TITLE', textKey: 'REQUESTS_GUIDE.DETAIL.CONTENT.TEXT' },
    ],
    videos: [],
  },
  // /rh/requests-history — listed under « Demandes ».
  'requests-history': {
    faq: [
      { id: 'requests-history-what', questionKey: 'GUIDE.CENTER.FAQ.REQ_HISTORY.WHAT.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_HISTORY.WHAT.A' },
      { id: 'requests-history-own', questionKey: 'GUIDE.CENTER.FAQ.REQ_HISTORY.OWN.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_HISTORY.OWN.A' },
      { id: 'requests-history-candidate', questionKey: 'GUIDE.CENTER.FAQ.REQ_HISTORY.CANDIDATE.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_HISTORY.CANDIDATE.A' },
    ],
    docs: [
      { titleKey: 'REQUESTS_GUIDE.HISTORY.TABS.TITLE', textKey: 'REQUESTS_GUIDE.HISTORY.TABS.TEXT' },
      { titleKey: 'REQUESTS_GUIDE.HISTORY.OTHER.TITLE', textKey: 'REQUESTS_GUIDE.HISTORY.OTHER.TEXT' },
      { titleKey: 'REQUESTS_GUIDE.HISTORY.RECRUITMENT.TITLE', textKey: 'REQUESTS_GUIDE.HISTORY.RECRUITMENT.TEXT' },
    ],
    videos: [],
  },
  // /rh/requests-history/:id — listed under « Demandes ».
  'recruitment-demand': {
    faq: [
      { id: 'recruitment-demand-decide', questionKey: 'GUIDE.CENTER.FAQ.REQ_DEMAND.DECIDE.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_DEMAND.DECIDE.A' },
      { id: 'recruitment-demand-cancel', questionKey: 'GUIDE.CENTER.FAQ.REQ_DEMAND.CANCEL.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_DEMAND.CANCEL.A' },
      { id: 'recruitment-demand-fields', questionKey: 'GUIDE.CENTER.FAQ.REQ_DEMAND.FIELDS.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_DEMAND.FIELDS.A' },
    ],
    docs: [
      { titleKey: 'REQUESTS_GUIDE.DEMAND.HEADER.TITLE', textKey: 'REQUESTS_GUIDE.DEMAND.HEADER.TEXT' },
      { titleKey: 'REQUESTS_GUIDE.DEMAND.DECIDE.TITLE', textKey: 'REQUESTS_GUIDE.DEMAND.DECIDE.TEXT' },
    ],
    videos: [],
  },
  // /rh/cdi-conversions — CIVP → CDI requests.
  'cdi-conversions': {
    faq: [
      { id: 'cdi-conversions-request', questionKey: 'GUIDE.CENTER.FAQ.CDI.REQUEST.Q', answerKey: 'GUIDE.CENTER.FAQ.CDI.REQUEST.A' },
      { id: 'cdi-conversions-steps', questionKey: 'GUIDE.CENTER.FAQ.CDI.STEPS.Q', answerKey: 'GUIDE.CENTER.FAQ.CDI.STEPS.A' },
      { id: 'cdi-conversions-approve', questionKey: 'GUIDE.CENTER.FAQ.CDI.APPROVE.Q', answerKey: 'GUIDE.CENTER.FAQ.CDI.APPROVE.A' },
      { id: 'cdi-conversions-reject', questionKey: 'GUIDE.CENTER.FAQ.CDI.REJECT.Q', answerKey: 'GUIDE.CENTER.FAQ.CDI.REJECT.A' },
      { id: 'cdi-conversions-convert', questionKey: 'GUIDE.CENTER.FAQ.CDI.CONVERT.Q', answerKey: 'GUIDE.CENTER.FAQ.CDI.CONVERT.A' },
      { id: 'cdi-conversions-todo', questionKey: 'GUIDE.CENTER.FAQ.CDI.TODO.Q', answerKey: 'GUIDE.CENTER.FAQ.CDI.TODO.A' },
      { id: 'cdi-conversions-own', questionKey: 'GUIDE.CENTER.FAQ.CDI.OWN.Q', answerKey: 'GUIDE.CENTER.FAQ.CDI.OWN.A' },
      { id: 'cdi-conversions-cancel', questionKey: 'GUIDE.CENTER.FAQ.CDI.CANCEL.Q', answerKey: 'GUIDE.CENTER.FAQ.CDI.CANCEL.A' },
      { id: 'cdi-conversions-evaluation', questionKey: 'GUIDE.CENTER.FAQ.CDI.EVALUATION.Q', answerKey: 'GUIDE.CENTER.FAQ.CDI.EVALUATION.A' },
    ],
    docs: [
      { titleKey: 'CDI_GUIDE.KPIS.TITLE', textKey: 'CDI_GUIDE.KPIS.TEXT' },
      { titleKey: 'CDI_GUIDE.TABS.TITLE', textKey: 'CDI_GUIDE.TABS.TEXT' },
      { titleKey: 'CDI_GUIDE.TABLE.TITLE', textKey: 'CDI_GUIDE.TABLE.TEXT' },
      { titleKey: 'CDI_GUIDE.DRAWER.TITLE', textKey: 'CDI_GUIDE.DRAWER.TEXT' },
    ],
    videos: [],
  },
  // /rh/missions — the manager's missions still being validated.
  'missions': {
    faq: [
      { id: 'missions-create', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.CREATE.A' },
      { id: 'missions-submit-disabled', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.SUBMIT_DISABLED.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.SUBMIT_DISABLED.A' },
      { id: 'missions-costs', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.COSTS.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.COSTS.A' },
      { id: 'missions-steps', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.STEPS.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.STEPS.A' },
      { id: 'missions-cancel', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.CANCEL.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.CANCEL.A' },
      { id: 'missions-late', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.LATE.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.LATE.A' },
      { id: 'missions-team', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.TEAM.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.TEAM.A' },
      { id: 'missions-change', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.CHANGE.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.CHANGE.A' },
      { id: 'missions-detail', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.DETAIL.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_LIST.DETAIL.A' },
    ],
    docs: [
      { titleKey: 'MISSIONS_GUIDE.LIST.NEW.TITLE', textKey: 'MISSIONS_GUIDE.LIST.NEW.TEXT' },
      { titleKey: 'MISSIONS_GUIDE.LIST.KPIS.TITLE', textKey: 'MISSIONS_GUIDE.LIST.KPIS.TEXT' },
      { titleKey: 'MISSIONS_GUIDE.LIST.TOOLBAR.TITLE', textKey: 'MISSIONS_GUIDE.LIST.TOOLBAR.TEXT' },
      { titleKey: 'MISSIONS_GUIDE.LIST.ITEMS.TITLE', textKey: 'MISSIONS_GUIDE.LIST.ITEMS.TEXT' },
    ],
    videos: [],
  },
  // /rh/missions/historique — listed under « Missions ».
  'missions-history': {
    faq: [
      { id: 'missions-history-what', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_HISTORY.WHAT.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_HISTORY.WHAT.A' },
      { id: 'missions-history-refused', questionKey: 'GUIDE.CENTER.FAQ.MISSIONS_HISTORY.REFUSED.Q', answerKey: 'GUIDE.CENTER.FAQ.MISSIONS_HISTORY.REFUSED.A' },
    ],
    docs: [
      { titleKey: 'MISSIONS_GUIDE.HISTORY.KPIS.TITLE', textKey: 'MISSIONS_GUIDE.HISTORY.KPIS.TEXT' },
      { titleKey: 'MISSIONS_GUIDE.HISTORY.TOOLBAR.TITLE', textKey: 'MISSIONS_GUIDE.HISTORY.TOOLBAR.TEXT' },
      { titleKey: 'MISSIONS_GUIDE.HISTORY.ITEMS.TITLE', textKey: 'MISSIONS_GUIDE.HISTORY.ITEMS.TEXT' },
    ],
    videos: [],
  },
  // /rh/billeterie — HR's mission desk.
  billeterie: {
    faq: [
      { id: 'billeterie-price', questionKey: 'GUIDE.CENTER.FAQ.BILLETERIE.PRICE.Q', answerKey: 'GUIDE.CENTER.FAQ.BILLETERIE.PRICE.A' },
      { id: 'billeterie-allowance', questionKey: 'GUIDE.CENTER.FAQ.BILLETERIE.ALLOWANCE.Q', answerKey: 'GUIDE.CENTER.FAQ.BILLETERIE.ALLOWANCE.A' },
      { id: 'billeterie-total', questionKey: 'GUIDE.CENTER.FAQ.BILLETERIE.TOTAL.Q', answerKey: 'GUIDE.CENTER.FAQ.BILLETERIE.TOTAL.A' },
      { id: 'billeterie-validate', questionKey: 'GUIDE.CENTER.FAQ.BILLETERIE.VALIDATE.Q', answerKey: 'GUIDE.CENTER.FAQ.BILLETERIE.VALIDATE.A' },
      { id: 'billeterie-reject', questionKey: 'GUIDE.CENTER.FAQ.BILLETERIE.REJECT.Q', answerKey: 'GUIDE.CENTER.FAQ.BILLETERIE.REJECT.A' },
      { id: 'billeterie-requests', questionKey: 'GUIDE.CENTER.FAQ.BILLETERIE.REQUESTS.Q', answerKey: 'GUIDE.CENTER.FAQ.BILLETERIE.REQUESTS.A' },
      { id: 'billeterie-late', questionKey: 'GUIDE.CENTER.FAQ.BILLETERIE.LATE.Q', answerKey: 'GUIDE.CENTER.FAQ.BILLETERIE.LATE.A' },
    ],
    docs: [
      { titleKey: 'BILLETERIE_GUIDE.KPIS.TITLE', textKey: 'BILLETERIE_GUIDE.KPIS.TEXT' },
      { titleKey: 'BILLETERIE_GUIDE.TABS.TITLE', textKey: 'BILLETERIE_GUIDE.TABS.TEXT' },
      { titleKey: 'BILLETERIE_GUIDE.TOOLBAR.TITLE', textKey: 'BILLETERIE_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'BILLETERIE_GUIDE.ITEMS.TITLE', textKey: 'BILLETERIE_GUIDE.ITEMS.TEXT' },
      { titleKey: 'BILLETERIE_GUIDE.PRICE.TITLE', textKey: 'BILLETERIE_GUIDE.PRICE.TEXT' },
      { titleKey: 'BILLETERIE_GUIDE.DECIDE.TITLE', textKey: 'BILLETERIE_GUIDE.DECIDE.TEXT' },
      { titleKey: 'BILLETERIE_GUIDE.REQUESTS.TITLE', textKey: 'BILLETERIE_GUIDE.REQUESTS.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin, /rh/candidates/list, /rh/profiles/user/:userId, /rh/onboarding/success, /rh/requests/inbox.
  'admin': {
    faq: [
      { id: 'admin-access', questionKey: 'GUIDE.CENTER.FAQ.ADMIN.ACCESS.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN.ACCESS.A' },
      { id: 'admin-country', questionKey: 'GUIDE.CENTER.FAQ.ADMIN.COUNTRY.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN.COUNTRY.A' },
      { id: 'admin-find', questionKey: 'GUIDE.CENTER.FAQ.ADMIN.FIND.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN.FIND.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_GUIDE.HEADER.TITLE', textKey: 'ADMIN_GUIDE.HEADER.TEXT' },
      { titleKey: 'ADMIN_GUIDE.CARDS.TITLE', textKey: 'ADMIN_GUIDE.CARDS.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=roles — the « Rôles & Permissions » card.
  'admin-roles': {
    faq: [
      { id: 'admin-roles-create', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.CREATE.A' },
      { id: 'admin-roles-permissions', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.PERMISSIONS.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.PERMISSIONS.A' },
      { id: 'admin-roles-assign', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.ASSIGN.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.ASSIGN.A' },
      { id: 'admin-roles-scope', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.SCOPE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.SCOPE.A' },
      { id: 'admin-roles-parent', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.PARENT.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.PARENT.A' },
      { id: 'admin-roles-delete', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.DELETE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.DELETE.A' },
      { id: 'admin-roles-rename', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.RENAME.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ROLES.RENAME.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_ROLES_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_ROLES_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_ROLES_GUIDE.NEW.TITLE', textKey: 'ADMIN_ROLES_GUIDE.NEW.TEXT' },
      { titleKey: 'ADMIN_ROLES_GUIDE.TABLE.TITLE', textKey: 'ADMIN_ROLES_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_ROLES_GUIDE.INFO.TITLE', textKey: 'ADMIN_ROLES_GUIDE.INFO.TEXT' },
      { titleKey: 'ADMIN_ROLES_GUIDE.SCOPE.TITLE', textKey: 'ADMIN_ROLES_GUIDE.SCOPE.TEXT' },
      { titleKey: 'ADMIN_ROLES_GUIDE.PERMISSIONS.TITLE', textKey: 'ADMIN_ROLES_GUIDE.PERMISSIONS.TEXT' },
      { titleKey: 'ADMIN_ROLES_GUIDE.USERS.TITLE', textKey: 'ADMIN_ROLES_GUIDE.USERS.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=users
  'admin-users': {
    faq: [
      { id: 'admin-users-create', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_USERS.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_USERS.CREATE.A' },
      { id: 'admin-users-login', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_USERS.LOGIN.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_USERS.LOGIN.A' },
      { id: 'admin-users-balance', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_USERS.BALANCE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_USERS.BALANCE.A' },
      { id: 'admin-users-technical', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_USERS.TECHNICAL.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_USERS.TECHNICAL.A' },
      { id: 'admin-users-sync', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_USERS.SYNC.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_USERS.SYNC.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_USERS_GUIDE.STATS.TITLE', textKey: 'ADMIN_USERS_GUIDE.STATS.TEXT' },
      { titleKey: 'ADMIN_USERS_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_USERS_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_USERS_GUIDE.CREATE.TITLE', textKey: 'ADMIN_USERS_GUIDE.CREATE.TEXT' },
      { titleKey: 'ADMIN_USERS_GUIDE.BALANCES.TITLE', textKey: 'ADMIN_USERS_GUIDE.BALANCES.TEXT' },
      { titleKey: 'ADMIN_USERS_GUIDE.TYPE.TITLE', textKey: 'ADMIN_USERS_GUIDE.TYPE.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=parameters
  'admin-parameters': {
    faq: [
      { id: 'admin-parameters-add', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_PARAMETERS.ADD.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_PARAMETERS.ADD.A' },
      { id: 'admin-parameters-seed', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_PARAMETERS.SEED.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_PARAMETERS.SEED.A' },
      { id: 'admin-parameters-seed-empty', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_PARAMETERS.SEED_EMPTY.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_PARAMETERS.SEED_EMPTY.A' },
      { id: 'admin-parameters-key', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_PARAMETERS.KEY.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_PARAMETERS.KEY.A' },
      { id: 'admin-parameters-entity', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_PARAMETERS.ENTITY.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_PARAMETERS.ENTITY.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_PARAMETERS_GUIDE.ACTIONS.TITLE', textKey: 'ADMIN_PARAMETERS_GUIDE.ACTIONS.TEXT' },
      { titleKey: 'ADMIN_PARAMETERS_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_PARAMETERS_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_PARAMETERS_GUIDE.TABLE.TITLE', textKey: 'ADMIN_PARAMETERS_GUIDE.TABLE.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=holidays
  'admin-holidays': {
    faq: [
      { id: 'admin-holidays-add', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_HOLIDAYS.ADD.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_HOLIDAYS.ADD.A' },
      { id: 'admin-holidays-date', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_HOLIDAYS.DATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_HOLIDAYS.DATE.A' },
      { id: 'admin-holidays-recurring', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_HOLIDAYS.RECURRING.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_HOLIDAYS.RECURRING.A' },
      { id: 'admin-holidays-year', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_HOLIDAYS.YEAR.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_HOLIDAYS.YEAR.A' },
      { id: 'admin-holidays-entity', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_HOLIDAYS.ENTITY.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_HOLIDAYS.ENTITY.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_HOLIDAYS_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_HOLIDAYS_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_HOLIDAYS_GUIDE.ADD.TITLE', textKey: 'ADMIN_HOLIDAYS_GUIDE.ADD.TEXT' },
      { titleKey: 'ADMIN_HOLIDAYS_GUIDE.TABLE.TITLE', textKey: 'ADMIN_HOLIDAYS_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_HOLIDAYS_GUIDE.CALENDAR.TITLE', textKey: 'ADMIN_HOLIDAYS_GUIDE.CALENDAR.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=absence-types
  'admin-absence-types': {
    faq: [
      { id: 'admin-absence-types-create', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ABSENCE_TYPES.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ABSENCE_TYPES.CREATE.A' },
      { id: 'admin-absence-types-code', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ABSENCE_TYPES.CODE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ABSENCE_TYPES.CODE.A' },
      { id: 'admin-absence-types-retire', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ABSENCE_TYPES.RETIRE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ABSENCE_TYPES.RETIRE.A' },
      { id: 'admin-absence-types-balance', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ABSENCE_TYPES.BALANCE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ABSENCE_TYPES.BALANCE.A' },
      { id: 'admin-absence-types-notice', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_ABSENCE_TYPES.NOTICE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_ABSENCE_TYPES.NOTICE.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_ABSENCE_TYPES_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_ABSENCE_TYPES_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_ABSENCE_TYPES_GUIDE.NEW.TITLE', textKey: 'ADMIN_ABSENCE_TYPES_GUIDE.NEW.TEXT' },
      { titleKey: 'ADMIN_ABSENCE_TYPES_GUIDE.RULES.TITLE', textKey: 'ADMIN_ABSENCE_TYPES_GUIDE.RULES.TEXT' },
      { titleKey: 'ADMIN_ABSENCE_TYPES_GUIDE.TABLE.TITLE', textKey: 'ADMIN_ABSENCE_TYPES_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_ABSENCE_TYPES_GUIDE.ACTIONS.TITLE', textKey: 'ADMIN_ABSENCE_TYPES_GUIDE.ACTIONS.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=pays-calendar
  'admin-pays-calendar': {
    faq: [
      { id: 'admin-pays-calendar-weekend', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_PAYS_CALENDAR.WEEKEND.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_PAYS_CALENDAR.WEEKEND.A' },
      { id: 'admin-pays-calendar-assumed', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_PAYS_CALENDAR.ASSUMED.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_PAYS_CALENDAR.ASSUMED.A' },
      { id: 'admin-pays-calendar-missing', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_PAYS_CALENDAR.MISSING.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_PAYS_CALENDAR.MISSING.A' },
      { id: 'admin-pays-calendar-none', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_PAYS_CALENDAR.NONE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_PAYS_CALENDAR.NONE.A' },
      { id: 'admin-pays-calendar-delays', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_PAYS_CALENDAR.DELAYS.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_PAYS_CALENDAR.DELAYS.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_PAYS_CALENDAR_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_PAYS_CALENDAR_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_PAYS_CALENDAR_GUIDE.TABLE.TITLE', textKey: 'ADMIN_PAYS_CALENDAR_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_PAYS_CALENDAR_GUIDE.EDIT.TITLE', textKey: 'ADMIN_PAYS_CALENDAR_GUIDE.EDIT.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=request-types
  'admin-request-types': {
    faq: [
      { id: 'admin-request-types-create', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REQUEST_TYPES.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REQUEST_TYPES.CREATE.A' },
      { id: 'admin-request-types-init', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REQUEST_TYPES.INIT.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REQUEST_TYPES.INIT.A' },
      { id: 'admin-request-types-approval', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REQUEST_TYPES.APPROVAL.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REQUEST_TYPES.APPROVAL.A' },
      { id: 'admin-request-types-sla', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REQUEST_TYPES.SLA.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REQUEST_TYPES.SLA.A' },
      { id: 'admin-request-types-deactivate', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REQUEST_TYPES.DEACTIVATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REQUEST_TYPES.DEACTIVATE.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_REQUEST_TYPES_GUIDE.ACTIONS.TITLE', textKey: 'ADMIN_REQUEST_TYPES_GUIDE.ACTIONS.TEXT' },
      { titleKey: 'ADMIN_REQUEST_TYPES_GUIDE.FORM.TITLE', textKey: 'ADMIN_REQUEST_TYPES_GUIDE.FORM.TEXT' },
      { titleKey: 'ADMIN_REQUEST_TYPES_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_REQUEST_TYPES_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_REQUEST_TYPES_GUIDE.TABLE.TITLE', textKey: 'ADMIN_REQUEST_TYPES_GUIDE.TABLE.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=regimes
  'admin-regimes': {
    faq: [
      { id: 'admin-regimes-create', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REGIMES.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REGIMES.CREATE.A' },
      { id: 'admin-regimes-role', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REGIMES.ROLE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REGIMES.ROLE.A' },
      { id: 'admin-regimes-override', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REGIMES.OVERRIDE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REGIMES.OVERRIDE.A' },
      { id: 'admin-regimes-delete', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REGIMES.DELETE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REGIMES.DELETE.A' },
      { id: 'admin-regimes-timezone', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REGIMES.TIMEZONE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REGIMES.TIMEZONE.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_REGIMES_GUIDE.TIMEZONE.TITLE', textKey: 'ADMIN_REGIMES_GUIDE.TIMEZONE.TEXT' },
      { titleKey: 'ADMIN_REGIMES_GUIDE.CATALOG.TITLE', textKey: 'ADMIN_REGIMES_GUIDE.CATALOG.TEXT' },
      { titleKey: 'ADMIN_REGIMES_GUIDE.EDITOR.TITLE', textKey: 'ADMIN_REGIMES_GUIDE.EDITOR.TEXT' },
      { titleKey: 'ADMIN_REGIMES_GUIDE.ROLES.TITLE', textKey: 'ADMIN_REGIMES_GUIDE.ROLES.TEXT' },
      { titleKey: 'ADMIN_REGIMES_GUIDE.OVERVIEW.TITLE', textKey: 'ADMIN_REGIMES_GUIDE.OVERVIEW.TEXT' },
      { titleKey: 'ADMIN_REGIMES_GUIDE.OVERRIDE.TITLE', textKey: 'ADMIN_REGIMES_GUIDE.OVERRIDE.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=breaks
  'admin-breaks': {
    faq: [
      { id: 'admin-breaks-create', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_BREAKS.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_BREAKS.CREATE.A' },
      { id: 'admin-breaks-types', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_BREAKS.TYPES.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_BREAKS.TYPES.A' },
      { id: 'admin-breaks-legal', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_BREAKS.LEGAL.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_BREAKS.LEGAL.A' },
      { id: 'admin-breaks-edit', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_BREAKS.EDIT.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_BREAKS.EDIT.A' },
      { id: 'admin-breaks-weekend', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_BREAKS.WEEKEND.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_BREAKS.WEEKEND.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_BREAKS_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_BREAKS_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_BREAKS_GUIDE.NEW.TITLE', textKey: 'ADMIN_BREAKS_GUIDE.NEW.TEXT' },
      { titleKey: 'ADMIN_BREAKS_GUIDE.TABLE.TITLE', textKey: 'ADMIN_BREAKS_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_BREAKS_GUIDE.LEGAL.TITLE', textKey: 'ADMIN_BREAKS_GUIDE.LEGAL.TEXT' },
      { titleKey: 'ADMIN_BREAKS_GUIDE.LEGAL_TABLE.TITLE', textKey: 'ADMIN_BREAKS_GUIDE.LEGAL_TABLE.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=overtime
  'admin-overtime': {
    faq: [
      { id: 'admin-overtime-create', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_OVERTIME.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_OVERTIME.CREATE.A' },
      { id: 'admin-overtime-replace', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_OVERTIME.REPLACE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_OVERTIME.REPLACE.A' },
      { id: 'admin-overtime-types', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_OVERTIME.TYPES.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_OVERTIME.TYPES.A' },
      { id: 'admin-overtime-simulate', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_OVERTIME.SIMULATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_OVERTIME.SIMULATE.A' },
      { id: 'admin-overtime-restdays', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_OVERTIME.RESTDAYS.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_OVERTIME.RESTDAYS.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_OVERTIME_GUIDE.SIMULATOR.TITLE', textKey: 'ADMIN_OVERTIME_GUIDE.SIMULATOR.TEXT' },
      { titleKey: 'ADMIN_OVERTIME_GUIDE.NEW.TITLE', textKey: 'ADMIN_OVERTIME_GUIDE.NEW.TEXT' },
      { titleKey: 'ADMIN_OVERTIME_GUIDE.TYPES.TITLE', textKey: 'ADMIN_OVERTIME_GUIDE.TYPES.TEXT' },
      { titleKey: 'ADMIN_OVERTIME_GUIDE.TABLE.TITLE', textKey: 'ADMIN_OVERTIME_GUIDE.TABLE.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=lists
  'admin-lists': {
    faq: [
      { id: 'admin-lists-add-value', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_LISTS.ADD_VALUE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_LISTS.ADD_VALUE.A' },
      { id: 'admin-lists-delete-value', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_LISTS.DELETE_VALUE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_LISTS.DELETE_VALUE.A' },
      { id: 'admin-lists-deactivate', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_LISTS.DEACTIVATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_LISTS.DEACTIVATE.A' },
      { id: 'admin-lists-code', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_LISTS.CODE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_LISTS.CODE.A' },
      { id: 'admin-lists-entity', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_LISTS.ENTITY.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_LISTS.ENTITY.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_LISTS_GUIDE.TABS.TITLE', textKey: 'ADMIN_LISTS_GUIDE.TABS.TEXT' },
      { titleKey: 'ADMIN_LISTS_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_LISTS_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_LISTS_GUIDE.ADD.TITLE', textKey: 'ADMIN_LISTS_GUIDE.ADD.TEXT' },
      { titleKey: 'ADMIN_LISTS_GUIDE.TABLE.TITLE', textKey: 'ADMIN_LISTS_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_LISTS_GUIDE.SYSTEM.TITLE', textKey: 'ADMIN_LISTS_GUIDE.SYSTEM.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=ref-data
  'admin-ref-data': {
    faq: [
      { id: 'admin-ref-data-add-entry', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REF_DATA.ADD_ENTRY.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REF_DATA.ADD_ENTRY.A' },
      { id: 'admin-ref-data-delete-entry', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REF_DATA.DELETE_ENTRY.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REF_DATA.DELETE_ENTRY.A' },
      { id: 'admin-ref-data-rename', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REF_DATA.RENAME.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REF_DATA.RENAME.A' },
      { id: 'admin-ref-data-notice', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REF_DATA.NOTICE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REF_DATA.NOTICE.A' },
      { id: 'admin-ref-data-entity', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_REF_DATA.ENTITY.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_REF_DATA.ENTITY.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_REF_DATA_GUIDE.TABS.TITLE', textKey: 'ADMIN_REF_DATA_GUIDE.TABS.TEXT' },
      { titleKey: 'ADMIN_REF_DATA_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_REF_DATA_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_REF_DATA_GUIDE.TABLE.TITLE', textKey: 'ADMIN_REF_DATA_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_REF_DATA_GUIDE.NOTICE.TITLE', textKey: 'ADMIN_REF_DATA_GUIDE.NOTICE.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=notifications
  'admin-notifications': {
    faq: [
      { id: 'admin-notifications-new-event', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_NOTIFICATIONS.NEW_EVENT.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_NOTIFICATIONS.NEW_EVENT.A' },
      { id: 'admin-notifications-recipients', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_NOTIFICATIONS.RECIPIENTS.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_NOTIFICATIONS.RECIPIENTS.A' },
      { id: 'admin-notifications-email-not-sent', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_NOTIFICATIONS.EMAIL_NOT_SENT.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_NOTIFICATIONS.EMAIL_NOT_SENT.A' },
      { id: 'admin-notifications-own-action', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_NOTIFICATIONS.OWN_ACTION.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_NOTIFICATIONS.OWN_ACTION.A' },
      { id: 'admin-notifications-variables', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_NOTIFICATIONS.VARIABLES.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_NOTIFICATIONS.VARIABLES.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_NOTIFICATIONS_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_NOTIFICATIONS_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_NOTIFICATIONS_GUIDE.TABLE.TITLE', textKey: 'ADMIN_NOTIFICATIONS_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_NOTIFICATIONS_GUIDE.RULE.TITLE', textKey: 'ADMIN_NOTIFICATIONS_GUIDE.RULE.TEXT' },
      { titleKey: 'ADMIN_NOTIFICATIONS_GUIDE.GENERAL.TITLE', textKey: 'ADMIN_NOTIFICATIONS_GUIDE.GENERAL.TEXT' },
      { titleKey: 'ADMIN_NOTIFICATIONS_GUIDE.TEMPLATES.TITLE', textKey: 'ADMIN_NOTIFICATIONS_GUIDE.TEMPLATES.TEXT' },
      { titleKey: 'ADMIN_NOTIFICATIONS_GUIDE.RECIPIENTS.TITLE', textKey: 'ADMIN_NOTIFICATIONS_GUIDE.RECIPIENTS.TEXT' },
      { titleKey: 'ADMIN_NOTIFICATIONS_GUIDE.TEST.TITLE', textKey: 'ADMIN_NOTIFICATIONS_GUIDE.TEST.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=interview-types
  'admin-interview-types': {
    faq: [
      { id: 'admin-interview-types-create', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_INTERVIEW_TYPES.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_INTERVIEW_TYPES.CREATE.A' },
      { id: 'admin-interview-types-deactivate', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_INTERVIEW_TYPES.DEACTIVATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_INTERVIEW_TYPES.DEACTIVATE.A' },
      { id: 'admin-interview-types-delete', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_INTERVIEW_TYPES.DELETE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_INTERVIEW_TYPES.DELETE.A' },
      { id: 'admin-interview-types-order', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_INTERVIEW_TYPES.ORDER.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_INTERVIEW_TYPES.ORDER.A' },
      { id: 'admin-interview-types-missing', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_INTERVIEW_TYPES.MISSING.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_INTERVIEW_TYPES.MISSING.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_INTERVIEW_TYPES_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_INTERVIEW_TYPES_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_INTERVIEW_TYPES_GUIDE.NEW.TITLE', textKey: 'ADMIN_INTERVIEW_TYPES_GUIDE.NEW.TEXT' },
      { titleKey: 'ADMIN_INTERVIEW_TYPES_GUIDE.TABLE.TITLE', textKey: 'ADMIN_INTERVIEW_TYPES_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_INTERVIEW_TYPES_GUIDE.STATUS.TITLE', textKey: 'ADMIN_INTERVIEW_TYPES_GUIDE.STATUS.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=offboarding-catalog
  'admin-offboarding-catalog': {
    faq: [
      { id: 'admin-offboarding-catalog-add-task', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_OFFBOARDING_CATALOG.ADD_TASK.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_OFFBOARDING_CATALOG.ADD_TASK.A' },
      { id: 'admin-offboarding-catalog-existing-file', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_OFFBOARDING_CATALOG.EXISTING_FILE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_OFFBOARDING_CATALOG.EXISTING_FILE.A' },
      { id: 'admin-offboarding-catalog-blocking', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_OFFBOARDING_CATALOG.BLOCKING.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_OFFBOARDING_CATALOG.BLOCKING.A' },
      { id: 'admin-offboarding-catalog-validator', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_OFFBOARDING_CATALOG.VALIDATOR.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_OFFBOARDING_CATALOG.VALIDATOR.A' },
      { id: 'admin-offboarding-catalog-delete-task', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_OFFBOARDING_CATALOG.DELETE_TASK.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_OFFBOARDING_CATALOG.DELETE_TASK.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_OFFBOARDING_CATALOG_GUIDE.VALIDATOR.TITLE', textKey: 'ADMIN_OFFBOARDING_CATALOG_GUIDE.VALIDATOR.TEXT' },
      { titleKey: 'ADMIN_OFFBOARDING_CATALOG_GUIDE.TYPES.TITLE', textKey: 'ADMIN_OFFBOARDING_CATALOG_GUIDE.TYPES.TEXT' },
      { titleKey: 'ADMIN_OFFBOARDING_CATALOG_GUIDE.ADD.TITLE', textKey: 'ADMIN_OFFBOARDING_CATALOG_GUIDE.ADD.TEXT' },
      { titleKey: 'ADMIN_OFFBOARDING_CATALOG_GUIDE.TABLE.TITLE', textKey: 'ADMIN_OFFBOARDING_CATALOG_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_OFFBOARDING_CATALOG_GUIDE.FLAGS.TITLE', textKey: 'ADMIN_OFFBOARDING_CATALOG_GUIDE.FLAGS.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=document-templates
  'admin-document-templates': {
    faq: [
      { id: 'admin-document-templates-create', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_DOCUMENT_TEMPLATES.CREATE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_DOCUMENT_TEMPLATES.CREATE.A' },
      { id: 'admin-document-templates-variables', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_DOCUMENT_TEMPLATES.VARIABLES.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_DOCUMENT_TEMPLATES.VARIABLES.A' },
      { id: 'admin-document-templates-preview', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_DOCUMENT_TEMPLATES.PREVIEW.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_DOCUMENT_TEMPLATES.PREVIEW.A' },
      { id: 'admin-document-templates-not-used', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_DOCUMENT_TEMPLATES.NOT_USED.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_DOCUMENT_TEMPLATES.NOT_USED.A' },
      { id: 'admin-document-templates-inactive', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_DOCUMENT_TEMPLATES.INACTIVE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_DOCUMENT_TEMPLATES.INACTIVE.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_DOCUMENT_TEMPLATES_GUIDE.TOOLBAR.TITLE', textKey: 'ADMIN_DOCUMENT_TEMPLATES_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'ADMIN_DOCUMENT_TEMPLATES_GUIDE.NEW.TITLE', textKey: 'ADMIN_DOCUMENT_TEMPLATES_GUIDE.NEW.TEXT' },
      { titleKey: 'ADMIN_DOCUMENT_TEMPLATES_GUIDE.CONTENT.TITLE', textKey: 'ADMIN_DOCUMENT_TEMPLATES_GUIDE.CONTENT.TEXT' },
      { titleKey: 'ADMIN_DOCUMENT_TEMPLATES_GUIDE.TABLE.TITLE', textKey: 'ADMIN_DOCUMENT_TEMPLATES_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_DOCUMENT_TEMPLATES_GUIDE.USAGE.TITLE', textKey: 'ADMIN_DOCUMENT_TEMPLATES_GUIDE.USAGE.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=sharepoint
  'admin-sharepoint': {
    faq: [
      { id: 'admin-sharepoint-add-path', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_SHAREPOINT.ADD_PATH.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_SHAREPOINT.ADD_PATH.A' },
      { id: 'admin-sharepoint-folder-missing', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_SHAREPOINT.FOLDER_MISSING.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_SHAREPOINT.FOLDER_MISSING.A' },
      { id: 'admin-sharepoint-required-docs', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_SHAREPOINT.REQUIRED_DOCS.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_SHAREPOINT.REQUIRED_DOCS.A' },
      { id: 'admin-sharepoint-sync-now', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_SHAREPOINT.SYNC_NOW.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_SHAREPOINT.SYNC_NOW.A' },
      { id: 'admin-sharepoint-force', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_SHAREPOINT.FORCE.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_SHAREPOINT.FORCE.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_SHAREPOINT_GUIDE.PATHS.TITLE', textKey: 'ADMIN_SHAREPOINT_GUIDE.PATHS.TEXT' },
      { titleKey: 'ADMIN_SHAREPOINT_GUIDE.REQUIRED.TITLE', textKey: 'ADMIN_SHAREPOINT_GUIDE.REQUIRED.TEXT' },
      { titleKey: 'ADMIN_SHAREPOINT_GUIDE.SYNC.TITLE', textKey: 'ADMIN_SHAREPOINT_GUIDE.SYNC.TEXT' },
      { titleKey: 'ADMIN_SHAREPOINT_GUIDE.KIND.TITLE', textKey: 'ADMIN_SHAREPOINT_GUIDE.KIND.TEXT' },
      { titleKey: 'ADMIN_SHAREPOINT_GUIDE.EMPLOYEES.TITLE', textKey: 'ADMIN_SHAREPOINT_GUIDE.EMPLOYEES.TEXT' },
      { titleKey: 'ADMIN_SHAREPOINT_GUIDE.DIAGNOSE.TITLE', textKey: 'ADMIN_SHAREPOINT_GUIDE.DIAGNOSE.TEXT' },
    ],
    videos: [],
  },
  // /rh/admin?tab=contract-alerts
  'admin-contract-alerts': {
    faq: [
      { id: 'admin-contract-alerts-change-delay', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_CONTRACT_ALERTS.CHANGE_DELAY.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_CONTRACT_ALERTS.CHANGE_DELAY.A' },
      { id: 'admin-contract-alerts-recipients', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_CONTRACT_ALERTS.RECIPIENTS.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_CONTRACT_ALERTS.RECIPIENTS.A' },
      { id: 'admin-contract-alerts-no-recipient', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_CONTRACT_ALERTS.NO_RECIPIENT.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_CONTRACT_ALERTS.NO_RECIPIENT.A' },
      { id: 'admin-contract-alerts-cdi', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_CONTRACT_ALERTS.CDI.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_CONTRACT_ALERTS.CDI.A' },
      { id: 'admin-contract-alerts-defaults', questionKey: 'GUIDE.CENTER.FAQ.ADMIN_CONTRACT_ALERTS.DEFAULTS.Q', answerKey: 'GUIDE.CENTER.FAQ.ADMIN_CONTRACT_ALERTS.DEFAULTS.A' },
    ],
    docs: [
      { titleKey: 'ADMIN_CONTRACT_ALERTS_GUIDE.TABLE.TITLE', textKey: 'ADMIN_CONTRACT_ALERTS_GUIDE.TABLE.TEXT' },
      { titleKey: 'ADMIN_CONTRACT_ALERTS_GUIDE.EDIT.TITLE', textKey: 'ADMIN_CONTRACT_ALERTS_GUIDE.EDIT.TEXT' },
      { titleKey: 'ADMIN_CONTRACT_ALERTS_GUIDE.STATUS.TITLE', textKey: 'ADMIN_CONTRACT_ALERTS_GUIDE.STATUS.TEXT' },
      { titleKey: 'ADMIN_CONTRACT_ALERTS_GUIDE.RUN.TITLE', textKey: 'ADMIN_CONTRACT_ALERTS_GUIDE.RUN.TEXT' },
    ],
    videos: [],
  },
  'candidate-list': {
    faq: [
      { id: 'candidate-list-what', questionKey: 'GUIDE.CENTER.FAQ.CAND_LIST.WHAT.Q', answerKey: 'GUIDE.CENTER.FAQ.CAND_LIST.WHAT.A' },
      { id: 'candidate-list-reach', questionKey: 'GUIDE.CENTER.FAQ.CAND_LIST.REACH.Q', answerKey: 'GUIDE.CENTER.FAQ.CAND_LIST.REACH.A' },
      { id: 'candidate-list-history', questionKey: 'GUIDE.CENTER.FAQ.CAND_LIST.HISTORY.Q', answerKey: 'GUIDE.CENTER.FAQ.CAND_LIST.HISTORY.A' },
    ],
    docs: [
      { titleKey: 'CAND_LIST_GUIDE.KPIS.TITLE', textKey: 'CAND_LIST_GUIDE.KPIS.TEXT' },
      { titleKey: 'CAND_LIST_GUIDE.TOOLBAR.TITLE', textKey: 'CAND_LIST_GUIDE.TOOLBAR.TEXT' },
      { titleKey: 'CAND_LIST_GUIDE.TABLE.TITLE', textKey: 'CAND_LIST_GUIDE.TABLE.TEXT' },
    ],
    videos: [],
  },
  'profile-new': {
    faq: [
      { id: 'profile-new-when', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_NEW.WHEN.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_NEW.WHEN.A' },
      { id: 'profile-new-required', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_NEW.REQUIRED.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_NEW.REQUIRED.A' },
      { id: 'profile-new-after', questionKey: 'GUIDE.CENTER.FAQ.PROFILE_NEW.AFTER.Q', answerKey: 'GUIDE.CENTER.FAQ.PROFILE_NEW.AFTER.A' },
    ],
    docs: [
      { titleKey: 'PROFILE_NEW_GUIDE.HEADER.TITLE', textKey: 'PROFILE_NEW_GUIDE.HEADER.TEXT' },
      { titleKey: 'PROFILE_NEW_GUIDE.FORM.TITLE', textKey: 'PROFILE_NEW_GUIDE.FORM.TEXT' },
    ],
    videos: [],
  },
  'onboarding-success': {
    faq: [
      { id: 'onboarding-success-what', questionKey: 'GUIDE.CENTER.FAQ.ONB_SUCCESS.WHAT.Q', answerKey: 'GUIDE.CENTER.FAQ.ONB_SUCCESS.WHAT.A' },
    ],
    docs: [
      { titleKey: 'ONB_SUCCESS_GUIDE.CARD.TITLE', textKey: 'ONB_SUCCESS_GUIDE.CARD.TEXT' },
    ],
    videos: [],
  },
  'requests-inbox': {
    faq: [
      { id: 'requests-inbox-what', questionKey: 'GUIDE.CENTER.FAQ.REQ_INBOX.WHAT.Q', answerKey: 'GUIDE.CENTER.FAQ.REQ_INBOX.WHAT.A' },
    ],
    docs: [
      { titleKey: 'REQ_INBOX_GUIDE.FILTERS.TITLE', textKey: 'REQ_INBOX_GUIDE.FILTERS.TEXT' },
      { titleKey: 'REQ_INBOX_GUIDE.TABLE.TITLE', textKey: 'REQ_INBOX_GUIDE.TABLE.TEXT' },
    ],
    videos: [],
  },
};

/**
 * Support contact shown at the bottom of the help center. Empty = not configured yet:
 * the « Support » card is then hidden rather than offering a dead « Écrire au support ».
 */
export const SUPPORT_CONTACT = {
  email: '',
};
