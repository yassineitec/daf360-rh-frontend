import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  AvatarComponent, AvatarData,
  ButtonComponent, DafCellDirective, DataTableComponent, FilterField, FilterResult,
  FormFieldComponent, MetricCardComponent, PaginationComponent, SearchToolbarComponent,
  SearchToolbarFilterConfig, SelectComponent, SelectOption, StatusBadgeComponent,
  TableColumn, TableConfig, TableRow, ToggleComponent, ToolbarAction, ToolbarToggleOption,
} from '@khalilrebhiitec/daf360';
import { environment } from '../../../../environments/environment';
import { ModalComponent } from '../../../shared/modal.component';
import { TableActionComponent } from '../../../shared/table-action.component';
import { NotificationService } from '../../../core/notification.service';
import { getAvatarUrl, getInitials } from '../../../shared/utils/avatar.utils';
import { flagDataUri } from '../flag-svgs';

interface AdminUserRow {
  id: number;
  fullName: string;
  username: string;
  email: string;
  employeeId: string | null;
  active: boolean;
  // Binary on purpose: the only question is whether this account is a person.
  employee: boolean;
  lastLoginAt: string | null;
  hasAzureIdentity: boolean;
  paysId: number | null;
  paysLabel: string | null;
  roleId: number | null;
  roleLabel: string | null;
  profileId: number | null;
  hasProfile: boolean;
  lifecycleStatus: string | null;
  photoUrl: string | null;
  gender: string | null;
  hireDate: string | null;
  /** Leave allowances, in days. Null means NOT RECORDED, which is not "none remaining". */
  soldeConge: number | null;
  soldeMaladie: number | null;
  soldeTeletravail: number | null;
}

/** The create-user form. Named rather than inlined so `patch` can take a Partial of it. */
interface CreateForm {
  fullName: string;
  email: string;
  roleId: number | null;
  paysId: number | null;
  isEmployee: boolean;
}

/** The balance-edit form. Strings, because an empty field has to mean "not recorded". */
interface BalanceForm {
  soldeConge: string;
  soldeMaladie: string;
  soldeTeletravail: string;
}

/**
 * Resultat par module renvoye par POST /api/hr/admin/users/propagate.
 *
 * `skipped` distingue « module absent de ce deploiement » de « module en panne » — sans
 * cette nuance, un deploiement sans paie afficherait une erreur a chaque synchronisation.
 */
interface ModuleSyncResult {
  module: string;
  ok: boolean;
  skipped: boolean;
  message: string;
  durationMs: number;
}

/** The source account a table row was built from (`_s`, see `load`). */
function userOf(row: TableRow): AdminUserRow {
  return row['_s'] as AdminUserRow;
}

interface AdminUserStats {
  total: number; employees: number; notEmployees: number;
  missingProfile: number; neverLoggedIn: number;
}

const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Administration → Utilisateurs: the account register, and where leave balances are set.
 *
 * WHY THIS SCREEN EXISTS
 * -----------------------------------------------------------------------------
 * No other screen can answer "which accounts are there". The employee list is deliberately
 * filtered to real people, so the rows an administrator needs to inspect here — test logins,
 * duplicated imports, service accounts — are precisely the ones it hides.
 *
 * WHY THE BALANCES ARE HERE
 * -----------------------------------------------------------------------------
 * `soldeConge`, `soldeMaladie` and `soldeTeletravail` are columns on `Users`, not on the HR
 * profile, so this register is the one screen that can reach every account that has them —
 * including the accounts with no HR file at all. Every other surface in the platform READS a
 * balance (the self-service modal, the régularisation form, the approval dialog); this is the
 * only one that writes it.
 *
 * NULL IS NOT ZERO, AND THE FORM KEEPS THE DIFFERENCE
 * -----------------------------------------------------------------------------
 * 135 of 260 users have no congé balance recorded. An empty field submits null — "not
 * recorded" — and `0` submits zero — "none left". Collapsing the two would tell half the
 * company they had run out of leave.
 *
 * EVERYTHING IS FILTERED CLIENT-SIDE
 * -----------------------------------------------------------------------------
 * The endpoint returns the whole register in one call — a few hundred rows — so the search,
 * the filters, the sort and the pager all work on the array. The congé screens do the
 * opposite because `/global` spans the company and cannot be held in memory.
 */
@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [
    MetricCardComponent, SearchToolbarComponent, PaginationComponent, DataTableComponent,
    DafCellDirective, StatusBadgeComponent, AvatarComponent, ButtonComponent,
    FormFieldComponent, SelectComponent, ToggleComponent, ModalComponent, TableActionComponent,
  ],
  template: `
    <div class="flex min-w-0 flex-col gap-6">

      <!-- Counted over the WHOLE register by its own endpoint, never over the filtered view:
           these four are the shape of the register, not of the current search. -->
      <section class="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-6">
        <daf-metric-card
          label="Comptes" [value]="stats()?.total ?? '—'"
          [options]="{ icon: 'group', iconColor: 'text-primary', iconBg: 'bg-primary/10',
                       help: 'Tous les comptes du registre, personnes et comptes techniques confondus.' }" />
        <daf-metric-card
          label="Personnes" [value]="stats()?.employees ?? '—'"
          [options]="{ icon: 'person', iconColor: 'text-secondary', iconBg: 'bg-secondary/10',
                       help: 'Comptes marqués comme appartenant à une personne réelle. Seuls ceux-ci apparaissent dans les listes et les notifications.' }" />
        <daf-metric-card
          label="Sans dossier RH" [value]="stats()?.missingProfile ?? '—'"
          [options]="{ icon: 'folder_off', iconColor: 'text-warning', iconBg: 'bg-warning/10',
                       help: 'Comptes sans fiche employé. Ni congés, ni contrat, ni bulletins tant qu’elle n’existe pas.' }" />
        <daf-metric-card
          label="Jamais connectés" [value]="stats()?.neverLoggedIn ?? '—'"
          [options]="{ icon: 'no_accounts', iconColor: 'text-outline', iconBg: 'bg-surface-container',
                       help: 'Comptes qui ne se sont jamais authentifiés — souvent un import en double ou une adresse absente d’Azure AD.' }" />
      </section>

      <daf-search-toolbar
        placeholder="Rechercher un nom, un e-mail, un identifiant…"
        [value]="search()"
        [debounce]="200"
        (valueChange)="onSearch($event)"
        [actions]="toolbarActions()"
        (action)="onToolbarAction($event)"
        [filterFields]="filterFields()"
        [filterConfig]="filterConfig()"
        (filterApply)="applyFilters($event)"
        [views]="viewOptions()"
        [view]="viewMode()"
        (viewChange)="viewMode.set($any($event))" />

      @if (error()) {
        <div class="flex items-center gap-2 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <span class="material-symbols-outlined text-[18px]">error</span>{{ error() }}
        </div>
      }

      @if (viewMode() === 'grid') {
        <div class="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3">
          @for (u of paged(); track u.id) {
            <div class="flex flex-col gap-3 rounded-xl border border-outline-variant/30
                        bg-surface-container-lowest p-4">
              <!-- daf-avatar, not a raw <img>: it falls back to initials when there is no
                   photo AND when the URL 404s, which a plain img renders as the browser's
                   broken-image glyph — indistinguishable from a bug in the page. -->
              <div class="flex items-center gap-3">
                <daf-avatar [data]="avatarData(u)" size="md" />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-semibold">{{ u.fullName }}</p>
                  <p class="truncate text-body-sm text-on-surface-variant">{{ u.email }}</p>
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <daf-badge [label]="u.employee ? 'Personne' : 'Compte technique'"
                           [options]="{ variant: u.employee ? 'info' : 'warning', size: 'sm', dot: true }" />
                @if (!u.hasProfile) {
                  <daf-badge label="Sans dossier RH" [options]="{ variant: 'warning', size: 'sm', dot: true }" />
                }
                @if (!u.lastLoginAt) {
                  <daf-badge label="Jamais connecté" [options]="{ variant: 'neutral', size: 'sm', dot: true }" />
                }
              </div>
              <dl class="grid grid-cols-3 gap-2 text-center">
                <div><dt class="text-body-sm text-on-surface-variant">Congés</dt>
                     <dd class="m-0 font-semibold tabular-nums">{{ days(u.soldeConge) }}</dd></div>
                <div><dt class="text-body-sm text-on-surface-variant">Maladie</dt>
                     <dd class="m-0 font-semibold tabular-nums">{{ days(u.soldeMaladie) }}</dd></div>
                <div><dt class="text-body-sm text-on-surface-variant">Télétravail</dt>
                     <dd class="m-0 font-semibold tabular-nums">{{ days(u.soldeTeletravail) }}</dd></div>
              </dl>
              <daf-button label="Modifier les soldes" variant="secondary"
                          [options]="{ size: 'sm', iconStart: 'edit_calendar', fullWidth: true }"
                          (onClick)="openBalances(u)" />
            </div>
          } @empty {
            <div class="col-span-full flex flex-col items-center gap-2 rounded-xl border
                        border-dashed border-outline-variant/50 px-6 py-14 text-center
                        text-on-surface-variant">
              <span class="material-symbols-outlined text-[40px] text-outline-variant">group_off</span>
              <p>Aucun compte ne correspond à ces critères.</p>
            </div>
          }
        </div>
      } @else {
        <daf-data-table [columns]="columns()" [rows]="tableRows()" [config]="config()">

          <ng-template dafCell="identity" let-row>
            <div class="flex items-center gap-2.5">
              <daf-avatar [data]="row['_avatar']" size="sm" />
              <div class="min-w-0">
                <p class="truncate font-medium text-on-surface">{{ row['_s'].fullName }}</p>
                <p class="truncate text-body-sm text-outline">{{ row['_s'].email }}</p>
              </div>
            </div>
          </ng-template>

          <ng-template dafCell="account" let-row>
            <div class="flex flex-wrap items-center gap-1.5">
              <daf-badge [label]="row['_s'].employee ? 'Personne' : 'Technique'"
                         [options]="{ variant: row['_s'].employee ? 'info' : 'warning', size: 'sm', dot: true }" />
              @if (!row['_s'].hasProfile) {
                <daf-badge label="Sans dossier" [options]="{ variant: 'warning', size: 'sm', dot: true }" />
              }
              @if (!row['_s'].active) {
                <daf-badge label="Désactivé" [options]="{ variant: 'danger', size: 'sm', dot: true }" />
              }
            </div>
          </ng-template>

          <ng-template dafCell="_actions" let-row>
            <div class="flex items-center justify-end gap-2">
              <!-- A calendar, not a piggy bank: these are days off, not money. -->
              <rh-table-action id="edit" icon="edit_calendar" tooltip="Modifier les soldes de congés"
                               (action)="openBalances(row['_s'])" />
              <!-- The icon shows what the click WILL DO, not what the row currently is:
                   on a person it offers to withdraw them, on a technical account to restore. -->
              <rh-table-action id="toggle"
                               [icon]="row['_s'].employee ? 'person_remove' : 'person_add'"
                               [tooltip]="row['_s'].employee
                                 ? 'Reclasser en compte technique — retire ce compte de toutes les listes de personnes'
                                 : 'Reclasser en personne réelle — le compte réapparaîtra dans les listes'"
                               (action)="onToggleEmployee(row['_s'])" />
            </div>
          </ng-template>

        </daf-data-table>
      }

      @if (totalPages() > 1) {
        <daf-pagination
          [currentPage]="currentPage()" [totalPages]="totalPages()"
          [totalElements]="filtered().length" [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizeOptions"
          perPageLabel="par page"
          (pageChange)="currentPage.set($event)"
          (pageSizeChange)="onPageSize($event)" />
      }
    </div>

    <!-- ── Soldes ──────────────────────────────────────────────────────────── -->
    <app-modal title="Soldes de congés" [visible]="showBalances()" size="md"
               [hasFooter]="true" (closed)="showBalances.set(false)">
      @if (balanceTarget(); as u) {
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <daf-avatar [data]="avatarData(u)" size="lg" />
            <div class="min-w-0">
              <p class="truncate font-semibold">{{ u.fullName }}</p>
              <p class="truncate text-body-sm text-on-surface-variant">{{ u.email }}</p>
            </div>
          </div>

          <!-- Said explicitly, because the difference is invisible once saved and it is the
               one thing about this form somebody will get wrong. -->
          <p class="rounded-lg bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
            Laisser un champ vide enregistre « non renseigné ». Saisir <strong>0</strong>
            enregistre « aucun jour restant » — ce n’est pas la même chose.
          </p>

          <daf-form-field
            [options]="{ label: 'Solde congés (jours)', type: 'number', fullWidth: true }"
            [value]="balanceForm().soldeConge"
            (valueChange)="patchBalance({ soldeConge: $any($event) ?? '' })" />
          <daf-form-field
            [options]="{ label: 'Solde maladie (jours)', type: 'number', fullWidth: true }"
            [value]="balanceForm().soldeMaladie"
            (valueChange)="patchBalance({ soldeMaladie: $any($event) ?? '' })" />
          <daf-form-field
            [options]="{ label: 'Solde télétravail (jours)', type: 'number', fullWidth: true }"
            [value]="balanceForm().soldeTeletravail"
            (valueChange)="patchBalance({ soldeTeletravail: $any($event) ?? '' })" />

          @if (balanceError()) { <div class="text-[13px] text-danger">{{ balanceError() }}</div> }
        </div>
      }
      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="showBalances.set(false)" />
        <daf-button label="Enregistrer" variant="teal"
                    [options]="{ loading: savingBalances() }"
                    (onClick)="submitBalances()" />
      </div>
    </app-modal>

    <!-- hasFooter is opt-in on app-modal: without it the footer slot is never rendered and
         the Créer button silently disappears. -->
    <app-modal title="Nouvel utilisateur" [visible]="showCreate()" size="md"
               [hasFooter]="true"
               (closed)="showCreate.set(false)">
      <div class="flex flex-col gap-3">
        <!-- Stated up front, because otherwise the first support ticket is
             "I created a user and they cannot log in". -->
        <p class="text-[12px] leading-relaxed text-on-surface-variant">
          Crée le compte DAF360 uniquement. La connexion se fait par Azure AD sur l’adresse
          e-mail : la personne ne pourra pas se connecter tant qu’un compte Azure avec cette
          même adresse n’existe pas. Aucune fiche RH n’est créée — le compte apparaîtra comme
          « fiche RH manquante ».
        </p>
        <daf-form-field [options]="{ label: 'Nom complet', required: true, fullWidth: true }"
                        [value]="form().fullName"
                        (valueChange)="patch({ fullName: $any($event) ?? '' })" />
        <daf-form-field [options]="{ label: 'E-mail', type: 'email', required: true, fullWidth: true }"
                        [value]="form().email"
                        (valueChange)="patch({ email: $any($event) ?? '' })" />
        <daf-select [selected]="selectedRoleValue()" [options]="roleOptions()"
                    [config]="{ label: 'Rôle', required: true, searchable: true, fullWidth: true }"
                    (selectedChange)="patch({ roleId: $event[0] ? +$event[0] : null })" />
        <daf-select [selected]="selectedPaysValue()" [options]="paysOptions()"
                    [config]="{ label: 'Entité', required: true, fullWidth: true, searchable: true }"
                    (selectedChange)="patch({ paysId: $event[0] ? +$event[0] : null })" />
        <daf-toggle [checked]="form().isEmployee"
                    [options]="{ label: 'Compte d’une personne réelle',
                                 hint: 'Décochez pour un compte de test ou technique : il n’apparaîtra dans aucune liste de personnes.' }"
                    (checkedChange)="patch({ isEmployee: $event })" />
        @if (createError()) { <div class="text-[13px] text-danger">{{ createError() }}</div> }
      </div>
      <div slot="footer">
        <daf-button label="Annuler" variant="secondary" (onClick)="showCreate.set(false)" />
        <daf-button label="Créer" variant="teal"
                    [options]="{ loading: creating(), disabled: !canCreate() }"
                    (onClick)="submitCreate()" />
      </div>
    </app-modal>
  `,
})
export class UsersAdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly notify = inject(NotificationService);
  private readonly base = `${environment.hrApiUrl}/api/hr/admin/users`;

  readonly users = signal<AdminUserRow[]>([]);
  readonly stats = signal<AdminUserStats | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  readonly viewMode = signal<'list' | 'grid'>('list');
  readonly search = signal('');
  readonly employeeFilter = signal<string>('');
  readonly paysFilter = signal<string>('');
  readonly roleFilter = signal<string>('');
  readonly onlyMissing = signal(false);
  readonly currentPage = signal(0);
  readonly pageSize = signal(PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly propagating = signal(false);

  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly form = signal<CreateForm>(
    { fullName: '', email: '', roleId: null, paysId: null, isEmployee: true });

  readonly showBalances = signal(false);
  readonly savingBalances = signal(false);
  readonly balanceError = signal<string | null>(null);
  readonly balanceTarget = signal<AdminUserRow | null>(null);
  readonly balanceForm = signal<BalanceForm>(
    { soldeConge: '', soldeMaladie: '', soldeTeletravail: '' });

  readonly roles = signal<{ id: number; frenchName: string }[]>([]);
  readonly paysList = signal<{ id: number; frenchLabel: string | null; isoCode: string | null }[]>([]);

  // ── Options ───────────────────────────────────────────────────────────────

  readonly roleOptions = computed<SelectOption[]>(() =>
    this.roles().map(r => ({ value: String(r.id), label: r.frenchName })));
  readonly paysOptions = computed<SelectOption[]>(() =>
    this.paysList().map(p => ({
      value: String(p.id),
      label: p.frenchLabel ?? p.isoCode ?? String(p.id),
      imageUrl: flagDataUri(p.isoCode),
    })));

  // daf-select takes string[]. Computed here rather than built in the template: a template
  // expression returning a new array each cycle re-renders the select on every tick.
  readonly selectedRoleValue = computed<string[]>(() =>
    this.form().roleId == null ? [] : [String(this.form().roleId)]);
  readonly selectedPaysValue = computed<string[]>(() =>
    this.form().paysId == null ? [] : [String(this.form().paysId)]);

  readonly canCreate = computed(() => {
    const f = this.form();
    return !!f.fullName.trim() && !!f.email.trim() && f.roleId != null && f.paysId != null;
  });

  // ── Toolbar ───────────────────────────────────────────────────────────────

  readonly viewOptions = computed<ToolbarToggleOption[]>(() => [
    { id: 'list', icon: 'view_list', tooltip: 'Tableau' },
    { id: 'grid', icon: 'grid_view', tooltip: 'Cartes' },
  ]);

  readonly toolbarActions = computed<ToolbarAction[]>(() => [
    { id: 'create', label: 'Nouveau compte', icon: 'person_add', position: 'right', variant: 'primary' },
    {
      id: 'sync', label: 'Synchroniser', icon: 'sync', position: 'right',
      tooltip: 'Pousse l’état des comptes vers finance et la paie sans attendre le rapprochement automatique',
      disabled: this.propagating(),
    },
  ]);

  readonly filterFields = computed<FilterField[]>(() => [
    {
      name: 'employee', label: 'Type de compte', type: 'select', placeholder: 'Tous',
      options: [
        { value: 'true', label: 'Personne réelle' },
        { value: 'false', label: 'Compte technique' },
      ],
    },
    {
      name: 'pays', label: 'Entité', type: 'select', placeholder: 'Toutes',
      options: this.paysOptions().map(o => ({ value: String(o.value), label: o.label })),
    },
    {
      name: 'role', label: 'Rôle', type: 'select', searchable: true, placeholder: 'Tous',
      options: this.roleOptions().map(o => ({ value: String(o.value), label: o.label })),
    },
    { name: 'missing', label: 'Sans dossier RH uniquement', type: 'checkbox' },
  ]);

  readonly filterConfig = computed<SearchToolbarFilterConfig>(() => ({
    title: 'Filtres', applyLabel: 'Appliquer', cancelLabel: 'Annuler',
    resetLabel: 'Réinitialiser', triggerLabel: 'Filtrer', align: 'right',
  }));

  // ── Projections ───────────────────────────────────────────────────────────

  readonly filtered = computed<AdminUserRow[]>(() => {
    const term = this.search().trim().toLowerCase();
    const emp = this.employeeFilter();
    const pays = this.paysFilter();
    const role = this.roleFilter();
    const missing = this.onlyMissing();
    return this.users().filter(u => {
      const matchesTerm = !term
        || u.fullName.toLowerCase().includes(term)
        || (u.email ?? '').toLowerCase().includes(term)
        || (u.username ?? '').toLowerCase().includes(term)
        || (u.employeeId ?? '').toLowerCase().includes(term);
      const matchesEmp = !emp || String(u.employee) === emp;
      const matchesPays = !pays || String(u.paysId) === pays;
      const matchesRole = !role || String(u.roleId) === role;
      return matchesTerm && matchesEmp && matchesPays && matchesRole
        && (!missing || !u.hasProfile);
    });
  });

  readonly totalPages = computed(() => Math.ceil(this.filtered().length / this.pageSize()));

  readonly paged = computed<AdminUserRow[]>(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filtered().slice(start, start + this.pageSize());
  });

  readonly columns = computed<TableColumn[]>(() => [
    { key: 'identity', label: 'Utilisateur', sortable: true,
      sortAccessor: (r) => String((r['_s'] as AdminUserRow).fullName) },
    { key: 'roleLabel', label: 'Rôle', sortable: true, width: '150px' },
    { key: 'paysLabel', label: 'Entité', sortable: true, width: '120px' },
    // One column per balance: they are three independent allowances, each sortable on its
    // own — "who is running out of sick days" is a different question from "who has annual
    // leave left", and a single combined cell could answer neither.
    //
    // `?? -1` in the accessors, not `?? 0`: a null balance is NOT RECORDED and must not sort
    // in among the people who genuinely have none left.
    { key: 'soldeConge', label: 'Congés', align: 'right', width: '100px',
      sortable: true, sortAccessor: (r) => (r['_s'] as AdminUserRow).soldeConge ?? -1 },
    { key: 'soldeMaladie', label: 'Maladie', align: 'right', width: '100px',
      sortable: true, sortAccessor: (r) => (r['_s'] as AdminUserRow).soldeMaladie ?? -1 },
    { key: 'soldeTeletravail', label: 'Télétravail', align: 'right', width: '110px',
      sortable: true, sortAccessor: (r) => (r['_s'] as AdminUserRow).soldeTeletravail ?? -1 },
    { key: 'account', label: 'Compte', width: '190px' },
    { key: 'lastLogin', label: 'Dernière connexion', sortable: true, width: '150px',
      sortAccessor: (r) => (r['_s'] as AdminUserRow).lastLoginAt ?? '' },
    // A real width, not `1%`: `resizableColumns` puts the table in `table-layout: fixed`,
    // where a declared width is honoured literally and 1% would collapse the icons.
    { key: '_actions', label: '', align: 'right', width: '104px' },
  ]);

  readonly tableRows = computed<TableRow[]>(() =>
    this.paged().map(u => ({
      id: u.id,
      roleLabel: u.roleLabel ?? '—',
      paysLabel: u.paysLabel ?? '—',
      lastLogin: u.lastLoginAt ? this.formatDate(u.lastLoginAt) : 'Jamais',
      // A dash for null, the figure for zero — the column picker can hide any of the three.
      soldeConge: this.days(u.soldeConge),
      soldeMaladie: this.days(u.soldeMaladie),
      soldeTeletravail: this.days(u.soldeTeletravail),
      _avatar: this.avatarData(u),
      // `_s` keeps the source row reachable from the custom cells.
      _s: u,
    })));

  readonly config = computed<TableConfig>(() => ({
    showHeader: false,
    hoverable: true,
    loading: this.loading(),
    skeletonRows: this.pageSize(),
    emptyMessage: 'Aucun compte ne correspond à ces critères.',
    resizableColumns: true,
    columnPicker: true,
    columnPickerLabel: 'Colonnes',
    rowId: (row) => String(row['id']),
  }));

  // ── Loading ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.load();
    this.http.get<{ id: number; frenchName: string }[]>(`${environment.hrApiUrl}/api/hr/admin/roles`)
      .subscribe({ next: r => this.roles.set(r ?? []), error: () => this.roles.set([]) });
    this.http.get<{ id: number; frenchLabel: string | null; isoCode: string | null }[]>(
      `${environment.hrApiUrl}/api/hr/ref/pays`)
      .subscribe({ next: p => this.paysList.set(p ?? []), error: () => this.paysList.set([]) });
  }

  /** The whole register in one call — see the class comment on why nothing is server-filtered. */
  load(): void {
    this.error.set(null);
    this.loading.set(true);
    this.http.get<AdminUserRow[]>(this.base).subscribe({
      next: list => { this.users.set(list ?? []); this.loading.set(false); },
      error: () => {
        this.users.set([]);
        this.loading.set(false);
        this.error.set('Erreur lors du chargement des comptes.');
      },
    });
    this.http.get<AdminUserStats>(`${this.base}/stats`)
      .subscribe({ next: s => this.stats.set(s), error: () => this.stats.set(null) });
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  onSearch(v: string): void {
    if (v === this.search()) return;   // daf-search-toolbar re-emits on blur
    this.search.set(v ?? '');
    this.currentPage.set(0);
  }

  applyFilters(r: FilterResult): void {
    this.employeeFilter.set(this.scalar(r['employee']) ?? '');
    this.paysFilter.set(this.scalar(r['pays']) ?? '');
    this.roleFilter.set(this.scalar(r['role']) ?? '');
    this.onlyMissing.set(r['missing'] === true);
    this.currentPage.set(0);
  }

  /** A `select` emits a scalar, a `multiselect` an array — normalise and treat '' as unset. */
  private scalar(v: unknown): string | null {
    const raw = Array.isArray(v) ? v[0] : v;
    return raw == null || raw === '' ? null : String(raw);
  }

  onToolbarAction(id: string): void {
    if (id === 'create') this.openCreate();
    if (id === 'sync') this.propagate();
  }

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(0);
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  /**
   * What `daf-avatar` needs: the photo (resolved by the same helper /rh/profiles uses), the
   * name, and the initials it falls back to when the photo is absent or fails to load.
   */
  avatarData(u: AdminUserRow): AvatarData {
    return {
      name: u.fullName ?? '',
      initials: getInitials(u.fullName ?? ''),
      avatarUrl: getAvatarUrl(u.profileId, u.photoUrl, u.gender),
    };
  }

  /** A dash for null, the figure for zero — "not recorded" is not "none left". */
  days(v: number | null): string {
    return v == null ? '—' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
  }

  employeeLabel(isEmployee: boolean): string {
    return isEmployee ? 'Employé' : 'Non-employé';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR',
      { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ── Balances ──────────────────────────────────────────────────────────────

  /** An empty string, not '0', for a null balance — the form's whole distinction. */
  openBalances(u: AdminUserRow): void {
    this.balanceTarget.set(u);
    this.balanceError.set(null);
    this.balanceForm.set({
      soldeConge: u.soldeConge == null ? '' : String(u.soldeConge),
      soldeMaladie: u.soldeMaladie == null ? '' : String(u.soldeMaladie),
      soldeTeletravail: u.soldeTeletravail == null ? '' : String(u.soldeTeletravail),
    });
    this.showBalances.set(true);
  }

  patchBalance(part: Partial<BalanceForm>): void {
    this.balanceForm.update(f => ({ ...f, ...part }));
  }

  submitBalances(): void {
    const u = this.balanceTarget();
    if (!u || this.savingBalances()) return;

    const f = this.balanceForm();
    const parsed: Record<string, number | null> = {};
    for (const key of ['soldeConge', 'soldeMaladie', 'soldeTeletravail'] as const) {
      const raw = (f[key] ?? '').trim();
      if (raw === '') { parsed[key] = null; continue; }   // cleared = not recorded
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        this.balanceError.set('Les soldes doivent être des nombres positifs, ou vides.');
        return;
      }
      parsed[key] = n;
    }

    this.savingBalances.set(true);
    this.balanceError.set(null);
    this.http.patch<AdminUserRow>(`${this.base}/${u.id}/balances`, parsed).subscribe({
      next: updated => {
        this.savingBalances.set(false);
        this.showBalances.set(false);
        // Patched in place rather than reloading the register: the server returns the saved
        // row, and re-fetching several hundred accounts to move three numbers is waste.
        this.users.update(list => list.map(x => (x.id === updated.id ? updated : x)));
        this.notify.success(`Soldes mis à jour pour ${updated.fullName}.`);
      },
      error: err => {
        this.savingBalances.set(false);
        this.balanceError.set(err?.error?.message ?? 'Erreur lors de l’enregistrement des soldes.');
      },
    });
  }

  // ── Account type ──────────────────────────────────────────────────────────

  /**
   * The widest-reaching write in the app: clearing the flag removes the account from every
   * picker and every notification recipient list at once. It does NOT deactivate it — a
   * machine account keeps working and keeps syncing to the other services, it just stops
   * being offered as a human. Reloaded afterwards so the counters move visibly.
   */
  onToggleEmployee(row: AdminUserRow): void {
    const next = !row.employee;
    this.http.patch<void>(`${this.base}/${row.id}/is-employee`, { isEmployee: next }).subscribe({
      next: () => {
        this.notify.success(`${row.fullName} : ${this.employeeLabel(next).toLowerCase()}.`);
        this.load();
        // Propagé sans le demander, et c'est le point : la copie de finance et de la paie
        // se rafraîchit d'elle-même toutes les 15 minutes, ce qui est bien trop long pour
        // une exclusion. Attendre un clic supplémentaire serait attendre qu'on y pense.
        this.propagate({ silentOnSuccess: true });
      },
      error: () => this.notify.error('Erreur lors du changement.'),
    });
  }

  /**
   * Pousse l'état des comptes vers finance et la paie tout de suite.
   *
   * Un échec n'est PAS présenté comme une perte : la modification RH est enregistrée, et
   * le rapprochement périodique de chaque module la reprendra dans le quart d'heure. Le
   * message le dit, sinon un module momentanément arrêté ferait croire que le changement
   * n'a pas été pris.
   *
   * @param opts.silentOnSuccess après une reclassification — l'utilisateur vient de voir
   *        un message de confirmation, un second n'apporte rien. Les échecs, eux, restent
   *        toujours signalés.
   */
  propagate(opts: { silentOnSuccess?: boolean } = {}): void {
    if (this.propagating()) return;
    this.propagating.set(true);
    this.http.post<ModuleSyncResult[]>(`${this.base}/propagate`, {}).subscribe({
      next: results => {
        this.propagating.set(false);
        const failed = results.filter(r => !r.ok && !r.skipped);
        if (failed.length) {
          this.notify.error(
            `Modules non joints : ${failed.map(r => `${r.module} (${r.message})`).join(', ')}. `
            + 'La modification est enregistrée et sera reprise sous 15 min.');
          return;
        }
        if (!opts.silentOnSuccess) {
          const done = results.filter(r => r.ok).map(r => r.module);
          this.notify.success(done.length
            ? `Modules synchronisés : ${done.join(', ')}.`
            : 'Aucun module configuré pour la synchronisation.');
        }
      },
      error: () => {
        this.propagating.set(false);
        this.notify.error('Synchronisation impossible. La reprise automatique aura lieu '
                          + 'sous 15 min.');
      },
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.form.set({ fullName: '', email: '', roleId: null, paysId: null, isEmployee: true });
    this.createError.set(null);
    this.showCreate.set(true);
  }

  patch(part: Partial<CreateForm>): void {
    this.form.update(f => ({ ...f, ...part }));
  }

  submitCreate(): void {
    if (!this.canCreate() || this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);
    this.http.post<AdminUserRow>(this.base, this.form()).subscribe({
      next: created => {
        this.creating.set(false);
        this.showCreate.set(false);
        this.notify.success(`Compte créé pour ${created.fullName}.`);
        this.load();
      },
      error: err => {
        this.creating.set(false);
        this.createError.set(err?.error?.message ?? 'Erreur lors de la création du compte.');
      },
    });
  }
}
