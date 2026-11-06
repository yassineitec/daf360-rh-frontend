import {
  Component, TemplateRef, afterNextRender, computed, effect, inject, signal, untracked, viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  ButtonComponent, FormFieldComponent, ModalService, PageComponent,
  PageHeaderComponent, PermissionService, SectionCardComponent, SelectComponent, SelectOption,
  StatusBadgeComponent, TabItem, TabsComponent, tabParam,
} from '@khalilrebhiitec/daf360';
import { GUIDE_PAGES, GuidePageDef, helpTabOf } from '../../shared/guide/guide-pages';
import {
  HELP_CONTENT, HelpDocSection, HelpFaq, HelpPageContent, HelpVideo, SUPPORT_CONTACT,
} from '../../shared/guide/help-content';
import { answersOf, rankAnswers } from '../../shared/guide/help-answers';
import { HelpChatService } from '../../shared/guide/help-chat.service';
import { PageGuideService } from '../../shared/guide/page-guide.service';

/** The two halves of a tab's content, behind the pill strip. */
type HelpSection = 'faq' | 'docs';

const NO_CONTENT: HelpPageContent = { faq: [], docs: [], videos: [] };

/**
 * /rh/aide — the « Aide & guides » page: one daf-tabs tab per page with a guide, each
 * holding that page's interactive guides, FAQ, documentation and videos, next to the
 * support contact. Typed questions go to the assistant bubble (`rh-help-chat`), opened
 * from the header. Content lives in `help-content.ts`, pages with a guide in `guide-pages.ts`.
 *
 * A tab also lists the guides of its sub-pages (`helpTab`): « Profils » holds the list's
 * guide and the profile file's. A sub-page whose URL carries an id (`pattern`) can only
 * be guided on the page the user came from — passed by the sidebar entry as `?page=`.
 *
 * The active tab is in the URL (`?tab=<guideKey>`, the library's `tabParam`), so F5, a
 * bookmark or a shared link reopens it. The sidebar's « Centre d'aide » entry
 * (`rh-help-center`) opens the tab of the page the user is on. The former
 * `?from=<guideKey>` link is still accepted and rewritten to `?tab=`.
 */
@Component({
  selector: 'app-help',
  standalone: true,
  imports: [
    TranslatePipe, ButtonComponent, FormFieldComponent, PageComponent,
    PageHeaderComponent, SectionCardComponent, SelectComponent, StatusBadgeComponent, TabsComponent,
  ],
  templateUrl: './help.component.html',
})
export class HelpComponent {
  private readonly router    = inject(Router);
  private readonly route     = inject(ActivatedRoute);
  private readonly perm      = inject(PermissionService);
  private readonly guide     = inject(PageGuideService);
  private readonly translate = inject(TranslateService);
  private readonly modal     = inject(ModalService);
  private readonly videoTpl  = viewChild.required<TemplateRef<unknown>>('videoTpl');
  readonly chat = inject(HelpChatService);

  readonly support = SUPPORT_CONTACT;
  /** The video shown in the player modal. */
  readonly playing = signal<HelpVideo | null>(null);

  /** Expanded FAQ entry (its id) or documentation section (its title key) — one at a time. */
  readonly openId = signal<string | null>(null);
  /** FAQ or documentation. daf-tabs falls back to the first one when the tab has no FAQ. */
  readonly section = signal<string>(   // a HelpSection; string for daf-tabs' [(active)]
    this.route.snapshot.queryParamMap.get('section') === 'docs' ? 'docs' : 'faq');

  /** The page the help center was opened from, when its URL carries an id (`?page=`). */
  private readonly fromUrl = toSignal(
    this.route.queryParamMap.pipe(map(q => q.get('page'))), { initialValue: null });

  /** Every guide the user may run. */
  readonly pages = computed(() =>
    GUIDE_PAGES.filter(p => p.permissions.length === 0 || this.perm.hasAny(p.permissions)));

  /** Pages with their own tab — sub-pages are listed inside their parent's. */
  private readonly tabPages = computed(() => this.pages().filter(p => !p.helpTab));

  readonly activeTab = tabParam(computed(() => this.tabPages().map(p => p.guideKey)), 'home');

  /** One tab per page. Labels re-translated on a language switch. */
  readonly tabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    return this.tabPages().map(p => ({
      id: p.guideKey,
      label: this.translate.instant(p.labelKey) as string,
      icon: p.icon,
    }));
  });

  /** The active tab's guides: its own page first, then its sub-pages. */
  readonly guides = computed(() => {
    const own = this.tabPages().find(p => p.guideKey === this.activeTab()) ?? this.tabPages()[0];
    if (!own) return [];
    return [own, ...this.pages().filter(p => p.helpTab === own.guideKey)];
  });

  /**
   * The sub-page picked in the chip row; null = the default one (see `subPage`). Starts on
   * the sub-page the help center was opened from (`?sub=admin-users`, an /rh/admin card).
   */
  private readonly subPagePick = signal<string | null>(this.route.snapshot.queryParamMap.get('sub'));
  /** Bumped to re-assert the dropdown's selection when it emits nothing usable. */
  private readonly selectNonce = signal(0);

  /**
   * Sub-page whose FAQ and documentation the card shows, for a tab with several guides
   * (« Profils » + « Fiche d'un collaborateur »): the one picked, else the one the help
   * center was opened from, else the tab's own page.
   */
  readonly subPage = computed<GuidePageDef | undefined>(() => {
    const guides = this.guides();
    const pick = this.subPagePick();
    return guides.find(g => g.guideKey === pick)
      ?? guides.find(g => g.pattern && this.startUrl(g) !== null)
      ?? guides[0];
  });

  readonly subPageSelected = computed(() => {
    this.selectNonce();
    return [this.subPage()?.guideKey ?? ''];
  });

  /** FAQ and documentation of the selected sub-page; videos of the whole tab. */
  readonly content = computed<HelpPageContent>(() => {
    const own = HELP_CONTENT[this.subPage()?.guideKey ?? ''] ?? NO_CONTENT;
    return {
      faq:    own.faq,
      docs:   own.docs,
      videos: this.guides().flatMap(p => HELP_CONTENT[p.guideKey]?.videos ?? []),
    };
  });

  /** Text of the search box above the FAQ / documentation. */
  readonly query = signal('');

  /**
   * The FAQ / documentation shown: all of the sub-page's, or — while something is typed —
   * those matching it, best first. Same matcher as the assistant (synonyms, no accents).
   */
  private readonly matches = computed(() => {
    const q = this.query().trim();
    const page = this.subPage();
    if (q.length < 2 || !page) return null;
    return rankAnswers(q, answersOf([page]), k => this.translate.instant(k) as string);
  });

  readonly shownFaq = computed<HelpFaq[]>(() => {
    const m = this.matches();
    return m ? m.flatMap(a => (a.kind === 'faq' ? [a.faq] : [])) : this.content().faq;
  });

  readonly shownDocs = computed<HelpDocSection[]>(() => {
    const m = this.matches();
    return m ? m.flatMap(a => (a.kind === 'doc' ? [a.doc] : [])) : this.content().docs;
  });

  /** A tab with several pages (its own + sub-pages) picks one in the « Section » dropdown. */
  readonly usePicker = computed(() => this.guides().length > 1);

  /**
   * The dropdown's options. With themes (`GuidePageDef.group`, the /rh/admin cards): the
   * tab's own page under « Général », then the sub-pages by theme, each theme headed by a
   * disabled row. Without: the pages in order, no headers.
   */
  readonly subPageOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k) as string;
    if (!this.guides().some(g => g.group)) {
      return this.guides().map(g => ({ value: g.guideKey, label: t(g.labelKey), icon: g.icon }));
    }
    const order: string[] = [];
    const byGroup = new Map<string, GuidePageDef[]>();
    for (const g of this.guides()) {
      const key = g.group ?? 'GENERAL';
      if (!byGroup.has(key)) { byGroup.set(key, []); order.push(key); }
      byGroup.get(key)!.push(g);
    }
    return order.flatMap(key => [
      { value: `__group-${key}`, label: t(`GUIDE.GROUPS.${key}`).toUpperCase(), disabled: true },
      ...byGroup.get(key)!.map(g => ({ value: g.guideKey, label: t(g.labelKey), icon: g.icon })),
    ]);
  });

  /** A theme header or an emptied selection keeps the current section. */
  onSubPageSelect(values: string[]): void {
    if (values[0] && !values[0].startsWith('__group-')) this.subPagePick.set(values[0]);
    else this.selectNonce.update(n => n + 1);
  }

  /** The right column's guide: the sub-page shown on the left, not all of the tab's. */
  readonly shownGuides = computed(() => {
    const p = this.subPage();
    return p ? [p] : [];
  });

  /** Only the halves the sub-page has content for. */
  readonly sectionTabs = computed<TabItem[]>(() => {
    this.translate.currentLang();
    const t = (k: string) => this.translate.instant(k) as string;
    const items: TabItem[] = [];
    if (this.content().faq.length)  items.push({ id: 'faq', label: t('GUIDE.CENTER.FAQ_TITLE'), icon: 'quiz' });
    if (this.content().docs.length) items.push({ id: 'docs', label: t('GUIDE.CENTER.DOCS_TITLE'), icon: 'menu_book' });
    return items;
  });


  constructor() {
    // Another sub-page: its own list, unfiltered.
    effect(() => {
      this.subPage();
      untracked(() => this.query.set(''));
    });
    // « Vidéos » in the help menu (`?section=videos`): bring the videos card into view.
    if (this.route.snapshot.queryParamMap.get('section') === 'videos') {
      afterNextRender(() =>
        document.getElementById('aide-videos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    // Old links (`?from=home`) land on the matching tab.
    const params = this.route.snapshot.queryParamMap;
    const from = params.get('from');
    if (from) {
      this.router.navigate([], {
        relativeTo: this.route, replaceUrl: true, queryParamsHandling: 'merge',
        queryParams: { from: null, tab: params.get('tab') ?? from },
      });
    }
  }

  /** Opens the video in a large library modal (maximizable), not a new window. */
  playVideo(video: HelpVideo): void {
    if (!video.url) return;
    this.playing.set(video);
    this.modal.open({
      title: this.translate.instant(video.titleKey) as string,
      subtitle: this.translate.instant('GUIDE.CENTER.MINUTES', { count: video.minutes }) as string,
      icon: 'play_circle',
      body: this.videoTpl(),
      width: '1100px',
      maximizable: true,
    });
  }

  toggle(id: string): void {
    this.openId.update(cur => (cur === id ? null : id));
  }

  /** Opens `page`'s tab, sub-page and half, `id` (a FAQ or doc entry) expanded. */
  openHit(page: GuidePageDef, id: string | null, section: HelpSection = 'faq'): void {
    this.activeTab.set(helpTabOf(page));
    this.subPagePick.set(page.guideKey);
    this.section.set(section);
    this.openId.set(id);
  }

  /**
   * Where `page`'s guide can start: the page the help center was opened from when it is
   * one of `page`'s (a profile file), the page's route otherwise; null when `page` needs
   * a specific record and the user didn't come from one.
   */
  startUrl(page: GuidePageDef): string | null {
    if (!page.pattern) return page.route;
    const url = this.fromUrl();
    return url?.startsWith('/') && page.pattern.test(url.split(/[?#]/)[0]) ? url : null;
  }

  /** Goes to the page, then asks its `rh-page-guide` to start. */
  startGuide(page: GuidePageDef): void {
    const url = this.startUrl(page);
    if (url === null) { this.openHit(page, null); return; }   // the tab says how to get one
    const nav = page.pattern
      ? this.router.navigateByUrl(url)
      : this.openPage(page);
    nav.then(() => this.guide.request(page.guideKey));
  }

  /** « Ouvrir » next to « Lancer »: a file's guide goes back to that file, others to their page. */
  openGuidePage(page: GuidePageDef): void {
    const url = this.startUrl(page);
    if (page.pattern && url) this.router.navigateByUrl(url);
    else this.openPage(page);
  }

  /** Goes to the page itself (for a sub-page with an id: its list, to pick one). */
  openPage(page: GuidePageDef): Promise<boolean> {
    return this.router.navigate(['..', ...page.route.split('/')], { relativeTo: this.route, queryParams: page.query });
  }
}
