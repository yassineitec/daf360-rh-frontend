import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  BreadcrumbItem,
  ButtonComponent,
  FormFieldComponent,
  MultiDatePickerComponent,
  PageComponent,
  PageHeaderBadge,
  PageHeaderComponent,
  SelectComponent,
  type SelectOption,
} from '@khalilrebhiitec/daf360';

import { ProfileService } from './profile.service';
import { ProfileListService } from './services/profile-list.service';
import { EmployeeListItem, EmployeeProfile, ProfileCreateDto } from './models/profile.model';
import { UserStore } from '../../core/user.store';
import { NotificationService } from '../../core/notification.service';
import { RefDataService } from '../../core/ref/ref-data.service';
import { RefDataItem } from '../../core/ref/ref-data.model';
import { SectionCardComponent } from '../../shared/detail/section-card.component';
import { NewProfileIdentityCardComponent } from './detail-sections/new-profile-identity-card.component';
import { toDate, fromDate, toSelected, fromSelected, asText } from './detail-sections/field-bridges';

/** Same rules the backend's `uploadPhoto` enforces — caught here so the user is told at once. */
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

/**
 * /rh/profiles/user/:userId — open the dossier of someone who has none yet.
 *
 * **Why this page exists.** `/rh/profiles` is the annuaire, and it lists *users*, not
 * profiles: 155 active accounts have no `employee_profiles` row and nearly all are real
 * people (the DRH and the PDG among them — see `UserScope`). Their cards were rendered
 * with a Consulter button that emitted a null id, and `onViewProfile` dropped it — the
 * click did nothing at all, with no explanation, and there was no way anywhere in the
 * application to give one of those people a dossier.
 *
 * So this is not a second "new profile wizard". The old one was removed on purpose,
 * because a profile is normally created by the Candidat → Onboarding pipeline and a
 * free-standing form invites a duplicate. This page can only ever be reached *for a user
 * who already exists and provably has no profile*: it carries the user in its URL, it
 * cannot invent one, and it redirects to the dossier the moment one turns up.
 *
 * **Shape is `/rh/profiles/:id`'s, on purpose** (UI-PLAYBOOK §10f): the same sticky
 * identity card on the left, `rh-section-card` panels on the right, the same fixed save
 * bar. It is the same record at an earlier moment, so it should not feel like a different
 * screen.
 *
 * **Three writes, not one.** The person's data is split across two tables and a file
 * store, and only one of the three can be written before the profile exists:
 * - `Users.fullName` — the name, via `PATCH /profiles/users/{userId}`.
 * - `employee_profiles` — everything in the form, via `POST /profiles`.
 * - the photo — via `POST /profiles/{id}/photo`, which is keyed by PROFILE id, so the file
 *   is staged locally and sent the moment that id exists.
 * See {@link submit} for the ordering and why a failure in the last two is not fatal.
 */
@Component({
  selector: 'app-profile-create',
  standalone: true,
  imports: [
    PageComponent, PageHeaderComponent, SectionCardComponent, NewProfileIdentityCardComponent,
    ButtonComponent, FormFieldComponent, SelectComponent, MultiDatePickerComponent,
    TranslatePipe,
  ],
  templateUrl: './profile-create.component.html',
})
export class ProfileCreateComponent implements OnInit, OnDestroy {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private svc       = inject(ProfileService);
  private listSvc   = inject(ProfileListService);
  private refSvc    = inject(RefDataService);
  private userStore = inject(UserStore);
  private notify    = inject(NotificationService);
  private translate = inject(TranslateService);

  /** The `Users.id` in the URL — this page's only identifier, since there is no profile id. */
  userId = 0;

  // ── Data ───────────────────────────────────────────────────────────────────
  readonly user       = signal<EmployeeListItem | null>(null);
  readonly firstLoad  = signal(true);
  readonly loadFailed = signal(false);
  readonly saving     = signal(false);
  readonly formError  = signal<string | null>(null);
  readonly nameError  = signal<string | null>(null);

  /**
   * Creating is `HR_CREATE_PROFILE`, exactly what `POST /api/hr/profiles` enforces.
   *
   * Checked here as well as in the list so the page is honest on a direct URL: without
   * it the form would fill in and fail on submit with a 403.
   */
  readonly canCreate = computed(() =>
    this.userStore.hasPermission('HR_CREATE_PROFILE') || this.userStore.isAdmin());

  // ── Form ───────────────────────────────────────────────────────────────────
  /** `Users.fullName`, not a profile field — written through its own endpoint. */
  readonly fullName         = signal('');
  readonly paysId           = signal<number | null>(null);
  readonly hireDate         = signal('');
  readonly contractType     = signal('');
  readonly contractEndDate  = signal('');
  readonly departmentId     = signal<number | null>(null);
  readonly gradeId          = signal<number | null>(null);
  readonly disciplineId     = signal<number | null>(null);
  readonly nogLevelId       = signal<number | null>(null);
  readonly personalEmail    = signal('');
  readonly personalPhone    = signal('');
  readonly personalAddress  = signal('');

  /** Only FIXED_TERM needs an end date — `@ValidFixedTermContract` rejects it missing. */
  readonly needsEndDate = computed(() => this.contractType() === 'FIXED_TERM');

  // ── Staged photo ───────────────────────────────────────────────────────────
  private photoFile = signal<File | null>(null);
  readonly photoPreview = signal<string | null>(null);

  /**
   * Stages a picked photo and previews it locally.
   *
   * Nothing is uploaded yet — `POST /profiles/{id}/photo` needs a profile id, which is the
   * one thing this page does not have. The rules below mirror the backend's so a file it
   * would reject is refused here rather than after the profile has been created.
   */
  onPhotoPicked(file: File): void {
    if (!PHOTO_TYPES.includes(file.type)) {
      this.notify.error(this.translate.instant('PROFILES.PHOTO.ERR_FORMAT'));
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      this.notify.error(this.translate.instant('PROFILES.PHOTO.ERR_SIZE'));
      return;
    }
    this.revokePreview();
    this.photoFile.set(file);
    this.photoPreview.set(URL.createObjectURL(file));
  }

  /** Object URLs are held by the document until revoked; the page owns both ends. */
  private revokePreview(): void {
    const url = this.photoPreview();
    if (url) URL.revokeObjectURL(url);
    this.photoPreview.set(null);
  }

  ngOnDestroy(): void {
    this.revokePreview();
  }

  // ── Reference data ─────────────────────────────────────────────────────────
  private readonly paysList    = signal<SelectOption[]>([]);
  private readonly departments = signal<RefDataItem[]>([]);
  private readonly grades      = signal<RefDataItem[]>([]);
  private readonly disciplines = signal<RefDataItem[]>([]);
  private readonly nogLevels   = signal<RefDataItem[]>([]);

  private blankOption(): SelectOption {
    return { value: '', label: this.translate.instant('PROFILES.COMMON.SELECT_PLACEHOLDER') };
  }
  private refOptions(items: RefDataItem[]): SelectOption[] {
    return [this.blankOption(), ...items.map(i => ({ value: String(i.id), label: i.labelFr }))];
  }

  readonly paysOptions       = computed(() => [this.blankOption(), ...this.paysList()]);
  readonly departmentOptions = computed(() => this.refOptions(this.departments()));
  readonly gradeOptions      = computed(() => this.refOptions(this.grades()));
  readonly disciplineOptions = computed(() => this.refOptions(this.disciplines()));
  readonly nogLevelOptions   = computed(() => this.refOptions(this.nogLevels()));

  readonly contractTypeOptions = computed<SelectOption[]>(() => {
    this.translate.currentLang();
    return [
      this.blankOption(),
      { value: 'PERMANENT',  label: this.translate.instant('PROFILES.CONTRACT_TYPE.PERMANENT')  },
      { value: 'FIXED_TERM', label: this.translate.instant('PROFILES.CONTRACT_TYPE.FIXED_TERM') },
      { value: 'INTERN',     label: this.translate.instant('PROFILES.CONTRACT_TYPE.INTERN')     },
      { value: 'CONSULTANT', label: this.translate.instant('PROFILES.CONTRACT_TYPE.CONSULTANT') },
    ];
  });

  // ── Header ─────────────────────────────────────────────────────────────────
  readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    this.translate.currentLang();
    return [
      { label: this.translate.instant('PROFILES.LIST.TITLE'), link: '/rh/profiles' },
      { label: this.user()?.fullName ?? this.translate.instant('PROFILES.CREATE.TITLE') },
    ];
  });

  readonly headerTitle = computed(() => {
    this.translate.currentLang();
    // The LOADED name, not the edited one: the h1 is this record's identity, and retitling
    // the page on every keystroke in the name field is noise, not feedback.
    return this.user()?.fullName || this.translate.instant('PROFILES.CREATE.TITLE');
  });

  /**
   * The badge row the dossier fills with lifecycle / contract / matricule — none of which
   * exists yet, which is exactly what the first badge says.
   */
  readonly headerBadges = computed<PageHeaderBadge[]>(() => {
    this.translate.currentLang();
    const u = this.user();
    if (!u) return [];
    const badges: PageHeaderBadge[] = [{
      label: this.translate.instant('PROFILES.CREATE.NO_PROFILE_BADGE'),
      variant: 'warning', size: 'sm', pill: true,
    }];
    if (u.paysLabel) badges.push({ label: u.paysLabel, variant: 'neutral', size: 'sm', icon: 'public' });
    if (u.roleName)  badges.push({ label: u.roleName,  variant: 'secondary', size: 'sm', icon: 'badge' });
    return badges;
  });

  protected readonly toDate       = toDate;
  protected readonly fromDate     = fromDate;
  protected readonly toSelected   = toSelected;
  protected readonly fromSelected = fromSelected;
  protected readonly asText       = asText;

  // ── Init ───────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.userId = Number(this.route.snapshot.paramMap.get('userId'));

    this.svc.getEmployeeByUserId(this.userId)
      .pipe(catchError(() => of(null)))
      .subscribe(user => {
        this.firstLoad.set(false);
        if (!user) { this.loadFailed.set(true); return; }

        // A profile appeared between the click and this load (the pipeline activated the
        // candidate, a colleague created it). Creating a second one would be rejected by
        // `existsByUserId` anyway, so go where the user meant to go.
        if (user.profileId != null) {
          this.router.navigate(['/rh/profiles', user.profileId], { replaceUrl: true });
          return;
        }

        this.user.set(user);
        this.fullName.set(user.fullName ?? '');
        this.paysId.set(user.paysId);
        // `email` is deliberately NOT copied into personalEmail: the list's email column is
        // `COALESCE(u.email, u.username)`, i.e. the work account, and `personal_email` is
        // the private address. Seeding one with the other writes a wrong value that nobody
        // would think to check.
        this.loadRefData(user.paysId ?? undefined);
      });

    // The entity list is loaded regardless: `Users.pays_id` is nullable, and a user without
    // one still needs a picker or the profile cannot be created at all.
    this.listSvc.getFilterOptions().subscribe(opts => this.paysList.set(opts.pays));
  }

  /**
   * Department / grade / discipline / NOG are scoped per entity, so they are re-read when
   * the entity changes. Cached by `RefDataService`, so switching back costs nothing.
   */
  private loadRefData(paysId?: number): void {
    this.refSvc.getDepartments(paysId).subscribe(r => this.departments.set(r));
    this.refSvc.getGrades(paysId).subscribe(r => this.grades.set(r));
    this.refSvc.getDisciplines(paysId).subscribe(r => this.disciplines.set(r));
    this.refSvc.getNogLevels(paysId).subscribe(r => this.nogLevels.set(r));
  }

  onPaysChange(values: string[]): void {
    const id = fromSelected(values);
    this.paysId.set(id);
    // The four position lists below belong to the entity — keep a stale pick and the
    // profile would carry a grade from another country.
    this.departmentId.set(null);
    this.gradeId.set(null);
    this.disciplineId.set(null);
    this.nogLevelId.set(null);
    this.loadRefData(id ?? undefined);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  /**
   * Creates the profile, then applies the two writes that could not run before it.
   *
   * Order is deliberate. The profile goes first because it is the only write that can be
   * rejected on validation, and because the photo has nowhere to go until its id exists —
   * renaming the user or storing a file for a profile that then fails to be created would
   * leave changes behind for a record that does not exist.
   *
   * The name and the photo are then sent together and **neither is fatal**: the dossier is
   * created either way, both are editable on the page we are about to open, and bouncing
   * the user back to a form whose main action already succeeded would invite a duplicate
   * submit. A failure is reported as a warning and the navigation still happens.
   */
  submit(): void {
    if (this.saving()) return;
    this.formError.set(null);
    this.nameError.set(null);

    if (!this.fullName().trim()) {
      this.nameError.set(this.translate.instant('PROFILES.CREATE.ERR_NAME'));
      this.formError.set(this.translate.instant('PROFILES.CREATE.ERR_NAME'));
      return;
    }
    const paysId = this.paysId();
    if (paysId == null) {
      this.formError.set(this.translate.instant('PROFILES.CREATE.ERR_PAYS')); return;
    }
    if (!this.hireDate()) {
      this.formError.set(this.translate.instant('PROFILES.CREATE.ERR_HIRE_DATE')); return;
    }
    if (!this.contractType()) {
      this.formError.set(this.translate.instant('PROFILES.CREATE.ERR_CONTRACT_TYPE')); return;
    }
    if (this.needsEndDate() && !this.contractEndDate()) {
      this.formError.set(this.translate.instant('PROFILES.CREATE.ERR_CONTRACT_END')); return;
    }

    const dto: ProfileCreateDto = {
      userId:   this.userId,
      paysId,
      // Ignored server-side since the matricule moved to `payroll_matricule`, allocated on
      // the transition to ACTIVE. Sent because the DTO field still exists.
      employeeId: 'AUTO',
      hireDate:     this.hireDate(),
      contractType: this.contractType(),
    };
    if (this.needsEndDate())         dto.contractEndDate = this.contractEndDate();
    if (this.departmentId() != null) dto.departmentId = this.departmentId()!;
    if (this.gradeId()      != null) dto.gradeId      = this.gradeId()!;
    if (this.disciplineId() != null) dto.disciplineId = this.disciplineId()!;
    if (this.nogLevelId()   != null) dto.nogLevelId   = this.nogLevelId()!;
    if (this.personalEmail())        dto.personalEmail = this.personalEmail();
    if (this.personalPhone())        dto.phone         = this.personalPhone();

    this.saving.set(true);
    this.svc.create(dto).subscribe({
      next: created => this.applyFollowUps(created),
      error: err => {
        this.saving.set(false);
        this.formError.set(this.extractErrorMessage(
          err, this.translate.instant('PROFILES.CREATE.ERR_CREATE')));
      },
    });
  }

  /** The name and the photo, once there is a profile id to hang the photo on. */
  private applyFollowUps(created: EmployeeProfile): void {
    const renamed = this.fullName().trim() !== (this.user()?.fullName ?? '').trim();
    const photo   = this.photoFile();

    const calls = {
      name: renamed
        ? this.svc.updateUserFields(this.userId, { fullName: this.fullName().trim() })
            .pipe(catchError(() => of('NAME_FAILED' as const)))
        : of(null),
      photo: photo
        ? this.svc.uploadPhoto(created.id, photo).pipe(catchError(() => of('PHOTO_FAILED' as const)))
        : of(null),
    };

    forkJoin(calls).subscribe(results => {
      this.saving.set(false);
      this.notify.success(this.translate.instant('PROFILES.CREATE.SUCCESS'));

      const failed = [
        results.name  === 'NAME_FAILED'  ? 'PROFILES.CREATE.WARN_NAME'  : null,
        results.photo === 'PHOTO_FAILED' ? 'PROFILES.CREATE.WARN_PHOTO' : null,
      ].filter((k): k is string => k !== null);
      for (const key of failed) this.notify.warning(this.translate.instant(key));

      // Straight into the dossier, in edit mode: the profile holds what was typed here and
      // nothing else, and everything left out is a field on that page.
      // `replaceUrl` so Back returns to the list rather than to a form that would now
      // bounce straight back here.
      this.router.navigate(['/rh/profiles', created.id],
        { queryParams: { edit: 'true' }, replaceUrl: true });
    });
  }

  /** Back to the directory. Nothing has been written yet, so there is nothing to undo. */
  cancel(): void {
    this.router.navigate(['/rh/profiles']);
  }

  /** Spring `ProblemDetail`: the message is under `detail`, or per field under `errors`. */
  private extractErrorMessage(err: unknown, fallback: string): string {
    const body = (err as { error?: { detail?: string; errors?: Record<string, string> } })?.error;
    if (body?.errors && typeof body.errors === 'object') {
      const messages = Object.values(body.errors).filter((v): v is string => typeof v === 'string');
      if (messages.length) return messages.join(' ');
    }
    return body?.detail ?? fallback;
  }
}
