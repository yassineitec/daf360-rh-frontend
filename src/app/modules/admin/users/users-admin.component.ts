import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BadgeOptions, ButtonComponent, DafCellDirective, DataTableComponent,
  FormFieldComponent, FormFieldOptions, SelectComponent, SelectOption,
  StatusBadgeComponent, TableColumn, TableConfig, TableRow, ToggleComponent,
} from '@khalilrebhiitec/daf360';
import { environment } from '../../../../environments/environment';
import { ModalComponent } from '../../../shared/modal.component';
import { NotificationService } from '../../../core/notification.service';

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
}

/** The create-user form. Named rather than inlined so `patch` can take a Partial of it. */
interface CreateForm {
  fullName: string;
  email: string;
  roleId: number | null;
  paysId: number | null;
  isEmployee: boolean;
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

interface AdminUserStats {
  total: number; employees: number; notEmployees: number;
  missingProfile: number; neverLoggedIn: number;
}

/**
 * Administration → Utilisateurs: the account register.
 *
 * Exists because no other screen can answer "which accounts are there". The employee list is
 * deliberately filtered to real people, so the rows an administrator needs to inspect here —
 * test logins, duplicated imports, service accounts — are precisely the ones it hides.
 *
 * Three things it shows that nothing else did: whether an account has an HR file, what kind of
 * account it is, and whether anyone has ever signed into it.
 */
@Component({
  selector: 'app-users-admin',
  standalone: true,
  imports: [
    DataTableComponent, DafCellDirective, StatusBadgeComponent,
    ButtonComponent, FormFieldComponent, SelectComponent, ModalComponent, ToggleComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">

      <!-- Counters. Missing-profile and never-signed-in are the two the screen is for, so
           they are stated rather than left to be counted by eye. -->
      @if (stats(); as s) {
        <div class="flex flex-wrap gap-2">
          <daf-badge [label]="s.total + ' comptes'" [options]="{ variant: 'neutral', size: 'sm' }" />
          <daf-badge [label]="s.employees + ' employés'" [options]="{ variant: 'info', size: 'sm' }" />
          @if (s.notEmployees) {
            <daf-badge [label]="s.notEmployees + ' non-employés'"
                       [options]="{ variant: 'warning', size: 'sm' }" />
          }
          <daf-badge [label]="s.missingProfile + ' sans fiche RH'"
                     [options]="{ variant: s.missingProfile ? 'danger' : 'success', size: 'sm' }" />
          <daf-badge [label]="s.neverLoggedIn + ' jamais connectés'"
                     [options]="{ variant: 'neutral', size: 'sm' }" />
        </div>
      }

      <div class="flex flex-wrap items-end gap-3">
        <div class="w-full sm:w-72">
          <daf-form-field [options]="searchOptions" [value]="search()"
                          (valueChange)="onSearch($any($event) ?? '')" />
        </div>
        <div class="w-full sm:w-56">
          <daf-select [selected]="[employeeFilter()]" [options]="employeeFilterOptions"
                      [config]="{ label: 'Type de compte', fullWidth: true }"
                      (selectedChange)="onEmployeeFilter($event[0])" />
        </div>
        <daf-button [label]="onlyMissing() ? 'Voir tous' : 'Sans fiche RH seulement'"
                    variant="secondary" [options]="{ size: 'sm', pill: false }"
                    (onClick)="toggleMissing()" />
        <span class="flex-1"></span>
        <!-- disabled et loading passent par options : daf-button n’expose pas d’entrée
             disabled propre, un [disabled] se serait contenté de ne rien faire. -->
        <daf-button label="Synchroniser les modules" variant="secondary"
                    [options]="{ iconStart: 'sync', size: 'sm', pill: false,
                                 loading: propagating(), disabled: propagating(),
                                 title: 'Pousser l’état des comptes vers finance et la paie'
                                        + ' sans attendre le rapprochement de 15 min' }"
                    (onClick)="propagate()" />
        <daf-button label="Nouvel utilisateur" variant="teal"
                    [options]="{ iconStart: 'person_add', size: 'sm' }"
                    (onClick)="openCreate()" />
      </div>

      @if (error()) { <div class="text-[13px] text-danger">{{ error() }}</div> }

      <daf-data-table [columns]="columns" [rows]="rows()" [config]="tableConfig">

        <ng-template dafCell="identity" let-row>
          <div class="min-w-0">
            <p class="truncate text-[13px] font-semibold text-on-surface">{{ row['_s'].fullName }}</p>
            <p class="truncate text-[11px] text-on-surface-variant">{{ row['_s'].email }}</p>
          </div>
        </ng-template>

        <!-- The answer this screen exists for. -->
        <ng-template dafCell="profile" let-row>
          @if (row['_s'].hasProfile) {
            <daf-badge [label]="row['_s'].lifecycleStatus ?? 'Fiche RH'"
                       [options]="{ variant: 'success', size: 'sm' }" />
          } @else {
            <daf-badge label="Fiche RH manquante" [options]="{ variant: 'danger', size: 'sm' }" />
          }
        </ng-template>

        <ng-template dafCell="account" let-row>
          <div class="flex flex-col items-start gap-1">
            <daf-badge [label]="employeeLabel(row['_s'].employee)"
                       [options]="employeeBadge(row['_s'].employee)" />
            @if (!row['_s'].active) {
              <daf-badge label="Désactivé" [options]="{ variant: 'neutral', size: 'sm' }" />
            }
            @if (!row['_s'].hasAzureIdentity) {
              <!-- Not the same as "never logged in": without an Azure identity the person
                   cannot sign in at all, which is the useful distinction. -->
              <daf-badge label="Sans identité Azure"
                         [options]="{ variant: 'warning', size: 'sm', outline: true }" />
            }
          </div>
        </ng-template>

        <ng-template dafCell="lastLogin" let-row>
          <span class="text-[12px]"
                [class]="row['_s'].lastLoginAt ? 'text-on-surface-variant' : 'text-danger'">
            {{ row['_s'].lastLoginAt ? formatDate(row['_s'].lastLoginAt) : 'jamais' }}
          </span>
        </ng-template>

        <ng-template dafCell="actions" let-row>
          <div class="w-44">
            <daf-button [label]="row['_s'].employee ? 'Marquer non-employé' : 'Marquer employé'"
                        [variant]="row['_s'].employee ? 'secondary' : 'teal'"
                        [options]="{ size: 'sm', pill: false }"
                        (onClick)="onToggleEmployee(row['_s'])" />
          </div>
        </ng-template>

      </daf-data-table>
    </div>

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
                    [config]="{ label: 'Entité', required: true, fullWidth: true }"
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

  readonly rows = signal<TableRow[]>([]);
  readonly stats = signal<AdminUserStats | null>(null);
  readonly error = signal<string | null>(null);

  readonly search = signal('');
  readonly employeeFilter = signal<string>('');
  readonly onlyMissing = signal(false);
  /** Bouton desactive pendant l'appel : deux propagations simultanees n'apportent rien. */
  readonly propagating = signal(false);

  readonly showCreate = signal(false);
  readonly creating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly form = signal<CreateForm>(
    { fullName: '', email: '', roleId: null, paysId: null, isEmployee: true });

  // Shapes and paths taken from role-management.service.ts rather than guessed: roles come
  // from /api/hr/admin/roles and countries from /api/hr/ref/pays with `frenchLabel`.
  readonly roles = signal<{ id: number; frenchName: string }[]>([]);
  readonly paysList = signal<{ id: number; frenchLabel: string | null; isoCode: string | null }[]>([]);

  readonly searchOptions: FormFieldOptions = {
    type: 'search', placeholder: 'Nom, e-mail ou identifiant',
    prefixIcon: 'search', fullWidth: true,
  };

  // Binary: the only question is whether the account is a person.
  readonly employeeFilterOptions: SelectOption[] = [
    { value: '',      label: 'Tous les comptes' },
    { value: 'true',  label: 'Employés' },
    { value: 'false', label: 'Non-employés' },
  ];

  readonly columns: TableColumn[] = [
    { key: 'identity',  label: 'Utilisateur', type: 'custom' },
    { key: 'roleLabel', label: 'Rôle',        type: 'text', width: '180px' },
    { key: 'paysLabel', label: 'Entité',      type: 'text', width: '140px' },
    { key: 'profile',   label: 'Fiche RH',    type: 'custom', width: '170px' },
    { key: 'account',   label: 'Compte',      type: 'custom', width: '170px' },
    { key: 'lastLogin', label: 'Dernière connexion', type: 'custom', width: '150px' },
    { key: 'actions',   label: 'Reclasser',   type: 'custom', width: '190px' },
  ];

  readonly tableConfig: TableConfig = {
    hoverable: true,
    emptyMessage: 'Aucun compte ne correspond à ces critères.',
  };

  readonly roleOptions = computed<SelectOption[]>(() =>
    this.roles().map(r => ({ value: String(r.id), label: r.frenchName })));
  readonly paysOptions = computed<SelectOption[]>(() =>
    this.paysList().map(p => ({ value: String(p.id), label: p.frenchLabel ?? p.isoCode ?? String(p.id) })));

  // daf-select takes string[]. Computed here rather than built in the template: a template
  // cannot call String(), which is exactly what broke the first build.
  readonly selectedRoleValue = computed<string[]>(() =>
    this.form().roleId != null ? [String(this.form().roleId)] : []);
  readonly selectedPaysValue = computed<string[]>(() =>
    this.form().paysId != null ? [String(this.form().paysId)] : []);

  readonly canCreate = computed(() => {
    const f = this.form();
    return !!f.fullName.trim() && !!f.email.trim() && !!f.roleId && !!f.paysId;
  });

  ngOnInit(): void {
    this.load();
    this.http.get<{ id: number; frenchName: string }[]>(`${environment.hrApiUrl}/api/hr/admin/roles`)
      .subscribe({ next: r => this.roles.set(r ?? []), error: () => this.roles.set([]) });
    this.http.get<{ id: number; frenchLabel: string | null; isoCode: string | null }[]>(
      `${environment.hrApiUrl}/api/hr/ref/pays`)
      .subscribe({ next: p => this.paysList.set(p ?? []), error: () => this.paysList.set([]) });
  }

  load(): void {
    this.error.set(null);
    const params: Record<string, string> = {};
    if (this.search().trim()) params['search'] = this.search().trim();
    if (this.employeeFilter()) params['isEmployee'] = this.employeeFilter();
    if (this.onlyMissing()) params['onlyMissingProfile'] = 'true';

    this.http.get<AdminUserRow[]>(this.base, { params }).subscribe({
      // `_s` keeps the source row reachable from the custom cells.
      next: list => this.rows.set((list ?? []).map(u => ({
        roleLabel: u.roleLabel ?? '—', paysLabel: u.paysLabel ?? '—', _s: u,
      }))),
      error: () => this.error.set('Erreur lors du chargement des comptes.'),
    });
    this.http.get<AdminUserStats>(`${this.base}/stats`)
      .subscribe({ next: s => this.stats.set(s), error: () => this.stats.set(null) });
  }

  onSearch(v: string): void { this.search.set(v); this.load(); }
  onEmployeeFilter(v: string): void { this.employeeFilter.set(v ?? ''); this.load(); }
  toggleMissing(): void { this.onlyMissing.update(v => !v); this.load(); }

  employeeLabel(isEmployee: boolean): string {
    return isEmployee ? 'Employé' : 'Non-employé';
  }
  employeeBadge(isEmployee: boolean): BadgeOptions {
    return { variant: isEmployee ? 'info' : 'warning', size: 'sm' };
  }
  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR',
      { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

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
