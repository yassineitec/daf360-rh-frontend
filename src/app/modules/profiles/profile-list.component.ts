import {
  Component, computed, inject, OnInit, signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  debounceTime, distinctUntilChanged, Subject, catchError, of,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ProfileService }    from './profile.service';
import { ProfileFilter, EmployeeListItem } from './models/profile.model';
import { StatusBadgeComponent } from '@khalilrebhiitec/daf360';
import { statusBadge } from '../../shared/status-badge.utils';
import { avatarUrl }   from '../../shared/utils/avatar.utils';
import { ModalComponent }       from '../../shared/modal.component';
import { UserStore }            from '../../core/user.store';
import { RefDataService }       from '../../core/ref/ref-data.service';
import { RefDataItem }          from '../../core/ref/ref-data.model';

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '',               label: 'Tous les statuts' },
  { value: 'PRE_ONBOARDING', label: 'Pré-onboarding' },
  { value: 'ACTIVE',         label: 'Actif' },
  { value: 'ON_LEAVE',       label: 'En congé' },
  { value: 'ON_MISSION',     label: 'En mission' },
  { value: 'OFFBOARDING',    label: 'Offboarding' },
  { value: 'TERMINATED',     label: 'Terminé' },
  { value: 'ARCHIVED',       label: 'Archivé' },
];

const PAGE_SIZE = 25;

@Component({
  selector: 'app-profile-list',
  standalone: true,
  imports: [RouterLink, FormsModule, StatusBadgeComponent, ModalComponent],
  template: `
    <!-- ── Page header ────────────────────────────────── -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Tous les employés</h1>
        <p class="page-sub">{{ total() }} employé{{ total() !== 1 ? 's' : '' }}</p>
      </div>
    </div>

    <!-- ── Filters ────────────────────────────────────── -->
    <div class="filters-bar">
      <div class="search-wrap">
        <svg class="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          class="search-input"
          type="search"
          placeholder="Nom, e-mail, identifiant…"
          [(ngModel)]="searchTerm"
          (ngModelChange)="onSearch($event)"
        />
      </div>

      <select class="filter-select" [(ngModel)]="filterStatus" (ngModelChange)="reload()">
        @for (opt of statusOptions; track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
        }
      </select>

      @if (hasActiveFilters()) {
        <button class="clear-btn" (click)="clearFilters()">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          Réinitialiser
        </button>
      }
    </div>

    <!-- ── Table ──────────────────────────────────────── -->
    <div class="card table-card">
      @if (loading()) {
        <div class="loading-rows">
          @for (_ of skeletonRows; track $index) {
            <div class="skeleton-row"></div>
          }
        </div>
      } @else if (rows().length === 0) {
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          <p>Aucun employé trouvé</p>
          @if (hasActiveFilters()) {
            <button class="btn-ghost" (click)="clearFilters()">Effacer les filtres</button>
          }
        </div>
      } @else {
        <div class="table-scroll">
          <table class="data-table" role="table">
            <thead>
              <tr>
                <th class="col-id">Matricule</th>
                <th class="col-name">Nom complet</th>
                <th class="col-email">Email</th>
                <th class="col-role">Rôle</th>
                <th class="col-entity">Entité</th>
                <th class="col-contract">Contrat</th>
                <th class="col-status">Statut</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.userId) {
                <tr class="data-row">
                  <!-- Matricule -->
                  <td class="cell-id">{{ row.employeeId ?? '—' }}</td>

                  <!-- Nom complet + avatar -->
                  <td class="cell-name">
                    <div class="name-cell">
                      <img class="avatar-sm" [src]="row.photoUrl || avatarUrl(row.gender)" [alt]="row.fullName" />
                      <span class="name-text">{{ row.fullName }}</span>
                    </div>
                  </td>

                  <!-- Email -->
                  <td class="cell-email">
                    <span class="email-text" [title]="row.email ?? ''">{{ row.email ?? '—' }}</span>
                  </td>

                  <!-- Rôle -->
                  <td class="cell-role">
                    @if (row.roleName) {
                      <span class="role-chip">{{ row.roleName }}</span>
                    } @else {
                      <span class="cell-muted">—</span>
                    }
                  </td>

                  <!-- Entité -->
                  <td class="cell-entity">{{ row.paysLabel ?? '—' }}</td>

                  <!-- Contrat -->
                  <td class="cell-contract">
                    @if (row.contractType) {
                      <span class="contract-chip">{{ row.contractType }}</span>
                    } @else {
                      <span class="cell-muted">—</span>
                    }
                  </td>

                  <!-- Statut -->
                  <td class="cell-status">
                    @if (row.hasProfile && row.lifecycleStatus) {
                      <daf-badge [label]="statusBadge(row.lifecycleStatus).label" [options]="statusBadge(row.lifecycleStatus).options" />
                    } @else {
                      <span class="badge-none">Sans profil</span>
                    }
                  </td>

                  <!-- Actions -->
                  <td class="cell-actions">
                    <div class="actions-wrap">
                      <!-- Voir — always enabled -->
                      @if (row.hasProfile && row.profileId != null) {
                        <a class="action-btn action-view" [routerLink]="['/profiles', row.profileId]" title="Voir le profil">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <span>Voir</span>
                        </a>
                      } @else {
                        <button class="action-btn action-view" type="button" title="Voir les informations" (click)="openViewUser(row)">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          <span>Voir</span>
                        </button>
                      }

                      <!-- Modifier / Créer profil — always enabled -->
                      @if (row.hasProfile && row.profileId != null) {
                        <a class="action-btn action-edit" [routerLink]="['/profiles', row.profileId]" title="Modifier le profil">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          <span>Modifier</span>
                        </a>
                      } @else {
                        <button class="action-btn action-create" type="button" title="Créer le profil RH" (click)="openCreateProfile(row)">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          <span>Créer profil</span>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (totalPages() > 1) {
          <div class="pagination">
            <span class="pag-info">{{ pageStart() }}–{{ pageEnd() }} sur {{ total() }}</span>
            <div class="pag-controls">
              <button (click)="goPage(page() - 1)" [disabled]="page() <= 0">‹ Préc.</button>
              <span class="pag-current">{{ page() + 1 }} / {{ totalPages() }}</span>
              <button (click)="goPage(page() + 1)" [disabled]="page() >= totalPages() - 1">Suiv. ›</button>
            </div>
          </div>
        }
      }
    </div>

    <!-- ── View user modal (no profile) ─────────────────────────── -->
    <app-modal title="Informations utilisateur" [visible]="showViewModal()" (closed)="showViewModal.set(false)" [hasFooter]="true">
      @if (viewedUser()) {
        <div class="user-info-grid">
          <div class="ui-field"><span class="ui-label">Nom complet</span><span class="ui-value">{{ viewedUser()!.fullName ?? '—' }}</span></div>
          <div class="ui-field"><span class="ui-label">Email</span><span class="ui-value">{{ viewedUser()!.email ?? '—' }}</span></div>
          <div class="ui-field"><span class="ui-label">Matricule</span><span class="ui-value">{{ viewedUser()!.employeeId ?? '—' }}</span></div>
          <div class="ui-field"><span class="ui-label">Rôle</span><span class="ui-value">{{ viewedUser()!.roleName ?? '—' }}</span></div>
          <div class="ui-field"><span class="ui-label">Entité</span><span class="ui-value">{{ viewedUser()!.paysLabel ?? '—' }}</span></div>
          <div class="ui-field ui-wide"><span class="ui-label">Statut profil</span><span class="badge-none">Aucun profil RH créé</span></div>
        </div>
      }
      <div slot="footer">
        <button type="button" class="btn-modal-secondary" (click)="showViewModal.set(false)">Fermer</button>
        <button type="button" class="btn-modal-primary" (click)="showViewModal.set(false); openCreateProfile(viewedUser()!)">Créer le profil RH →</button>
      </div>
    </app-modal>

    <!-- ── Create profile modal (full form) ─────────────────────── -->
    <app-modal title="Créer le profil RH" [visible]="showCreateModal()" (closed)="closeCreateModal()" [hasFooter]="true">
      @if (createTarget()) {
        <div class="create-form">
          <div class="cf-banner">
            <strong>{{ createTarget()!.fullName }}</strong> — {{ createTarget()!.email }} — {{ createTarget()!.paysLabel }}
          </div>
          @if (createError()) { <div class="cf-error">{{ createError() }}</div> }

          <!-- Section 1: Emploi -->
          <div class="cf-section-title">Informations d'emploi</div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Matricule</label>
              <div style="background:#f2f4f6;border-radius:8px;padding:8px 12px;font-size:13px;color:#44474c;display:flex;align-items:center;gap:8px;">
                <span class="material-symbols-outlined" style="font-size:15px;color:#1a6b7c;">auto_awesome</span>
                Généré automatiquement lors du provisioning IT
              </div>
              <small class="cf-hint">Format : [NOM3][PRE3][ID] — ex : DUPPIE125</small>
            </div>
            <div class="cf-field">
              <label>Date d'embauche <span class="req">*</span></label>
              <input type="date" [(ngModel)]="cfHireDate" />
            </div>
          </div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Type de contrat <span class="req">*</span></label>
              <select [(ngModel)]="cfContractType">
                <option value="">— Choisir —</option>
                <option value="PERMANENT">CDI (Permanent)</option>
                <option value="FIXED_TERM">CDD (Durée déterminée)</option>
                <option value="INTERN">Stage</option>
                <option value="CONSULTANT">Consultant / Freelance</option>
              </select>
            </div>
            <div class="cf-field">
              <label>Département</label>
              <select [(ngModel)]="cfDepartmentId" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
                <option [ngValue]="null">— Département —</option>
                @for (d of departments(); track d.id) { <option [ngValue]="d.id">{{ d.labelFr }}</option> }
              </select>
            </div>
          </div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Date fin de contrat</label>
              <input type="date" [(ngModel)]="cfContractEndDate" [disabled]="cfContractType !== 'FIXED_TERM'" />
              @if (cfContractType === 'FIXED_TERM') { <small class="cf-hint">Obligatoire pour un CDD</small> }
            </div>
            <div class="cf-field">
              <label>Fin période d'essai</label>
              <input type="date" [(ngModel)]="cfProbationEndDate" />
            </div>
          </div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Grade</label>
              <select [(ngModel)]="cfGradeId" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (g of grades(); track g.id) { <option [ngValue]="g.id">{{ g.labelFr }}</option> }
              </select>
            </div>
            <div class="cf-field">
              <label>Discipline</label>
              <select [(ngModel)]="cfDisciplineId" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (d of disciplines(); track d.id) { <option [ngValue]="d.id">{{ d.labelFr }}</option> }
              </select>
            </div>
          </div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Niveau NOG</label>
              <select [(ngModel)]="cfNogLevelId" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (n of nogLevels(); track n.id) { <option [ngValue]="n.id">{{ n.labelFr }}</option> }
              </select>
            </div>
          </div>

          <!-- Section 2: Identité -->
          <div class="cf-section-title">Informations personnelles</div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Genre</label>
              <select [(ngModel)]="cfGender">
                <option value="">— Choisir —</option>
                <option value="MALE">Homme</option>
                <option value="FEMALE">Femme</option>
                <option value="OTHER">Autre</option>
                <option value="UNSPECIFIED">Non spécifié</option>
              </select>
            </div>
            <div class="cf-field">
              <label>Date de naissance</label>
              <input type="date" [(ngModel)]="cfDateOfBirth" />
            </div>
          </div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Nationalité</label>
              <select [(ngModel)]="cfNationalityId" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
                <option [ngValue]="null">— Sélectionner —</option>
                @for (n of nationalities(); track n.id) { <option [ngValue]="n.id">{{ n.labelFr }}</option> }
              </select>
            </div>
            <div class="cf-field">
              <label>N° CIN / Carte nationale</label>
              <input type="text" [(ngModel)]="cfNationalId" placeholder="Ex: 00365675" />
            </div>
          </div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Téléphone</label>
              <input type="tel" [(ngModel)]="cfPhone" placeholder="Ex: +216 99 999 999" />
            </div>
            <div class="cf-field">
              <label>Email personnel</label>
              <input type="email" [(ngModel)]="cfPersonalEmail" placeholder="Ex: prenom.nom@gmail.com" />
            </div>
          </div>
          <div class="cf-row">
            <div class="cf-field cf-full">
              <label>Adresse personnelle</label>
              <input type="text" [(ngModel)]="cfHomeAddress" placeholder="Adresse complète" />
            </div>
          </div>

          <!-- Section 3: Contact urgence -->
          <div class="cf-section-title">Contact d'urgence</div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Nom contact urgence</label>
              <input type="text" [(ngModel)]="cfEmergencyName" placeholder="Nom et prénom" />
            </div>
            <div class="cf-field">
              <label>Relation</label>
              <input type="text" [(ngModel)]="cfEmergencyRelation" placeholder="Ex: Épouse, Père…" />
            </div>
          </div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Téléphone urgence</label>
              <input type="tel" [(ngModel)]="cfEmergencyPhone" placeholder="Ex: +216 99 999 999" />
            </div>
          </div>

          <!-- Section 4: Bancaire -->
          <div class="cf-section-title">Coordonnées bancaires</div>
          <div class="cf-row">
            <div class="cf-field">
              <label>Banque</label>
              <select [(ngModel)]="cfBankId" style="width:100%;background:#f2f4f6;border:none;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;">
                <option [ngValue]="null">— Banque —</option>
                @for (b of banks(); track b.id) { <option [ngValue]="b.id">{{ b.labelFr }}</option> }
              </select>
            </div>
            <div class="cf-field">
              <label>RIB</label>
              <input type="text" [(ngModel)]="cfRib" placeholder="Ex: 07 006 0000000000000 65" />
            </div>
          </div>
          <div class="cf-row">
            <div class="cf-field">
              <label>IBAN</label>
              <input type="text" [(ngModel)]="cfIban" placeholder="Ex: TN5907006000000000000065" />
            </div>
          </div>
        </div>
      }
      <div slot="footer">
        <button type="button" class="btn-modal-secondary" (click)="closeCreateModal()">Annuler</button>
        <button type="button" class="btn-modal-primary" (click)="submitCreate()" [disabled]="creating()">
          {{ creating() ? 'Création en cours…' : 'Créer le profil RH' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [`
    /* ── Table scroll wrapper ───────────────────────────────────── */
    .table-scroll { overflow-x: auto; }

    /* ── Column widths ──────────────────────────────────────────── */
    .col-id       { width: 110px; }
    .col-name     { min-width: 200px; }
    .col-email    { min-width: 180px; }
    .col-role     { width: 130px; }
    .col-entity   { width: 110px; }
    .col-contract { width: 100px; }
    .col-status   { width: 130px; }
    .col-actions  { width: 160px; }

    /* ── Hover row ──────────────────────────────────────────────── */
    .data-row { transition: background 0.12s; }
    .data-row:hover { background: var(--surface-hover, #f5f7fa); }

    /* ── Name cell ──────────────────────────────────────────────── */
    .name-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .name-text { font-weight: 500; white-space: nowrap; }

    /* ── Email truncation ───────────────────────────────────────── */
    .cell-email { max-width: 200px; }
    .email-text {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-secondary, #6b7280);
      font-size: 0.85rem;
    }

    /* ── Role chip ──────────────────────────────────────────────── */
    .role-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--surface-muted, #f1f3f6);
      color: var(--text-secondary, #4b5563);
      font-size: 0.78rem;
      font-weight: 500;
      white-space: nowrap;
    }

    /* ── Sans profil badge ──────────────────────────────────────── */
    .badge-none {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: #e5e7eb;
      color: #9ca3af;
      font-size: 0.78rem;
      font-weight: 500;
    }

    /* ── Actions ────────────────────────────────────────────────── */
    .actions-wrap {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      border: 1px solid transparent;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
      white-space: nowrap;
    }
    .action-view {
      background: var(--color-primary-light, #eff6ff);
      color: var(--color-primary, #2563eb);
      border-color: var(--color-primary-border, #bfdbfe);
    }
    .action-view:hover:not(:disabled) {
      background: var(--color-primary, #2563eb);
      color: #fff;
    }
    .action-edit {
      background: var(--surface-muted, #f3f4f6);
      color: var(--text-secondary, #374151);
      border-color: #d1d5db;
    }
    .action-edit:hover:not(:disabled) {
      background: #e5e7eb;
      color: #111827;
    }
    .action-disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /* ── Muted text ─────────────────────────────────────────────── */
    .cell-muted { color: var(--text-muted, #9ca3af); }

    /* ── Create button ──────────────────────────────────────────── */
    .action-create {
      background: #f0fdf4; color: #15803d; border-color: #86efac;
    }
    .action-create:hover { background: #15803d; color: #fff; }

    /* ── View-user modal ────────────────────────────────────────── */
    .user-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 4px 0; }
    .ui-field { display: flex; flex-direction: column; gap: 3px; }
    .ui-wide  { grid-column: 1 / -1; }
    .ui-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #9ca3af; letter-spacing: .4px; }
    .ui-value { font-size: 13px; color: var(--color-text, #111); }

    /* ── Create-profile form ────────────────────────────────────── */
    .create-form { display: flex; flex-direction: column; gap: 12px; }
    .cf-banner { background: #f0f9fb; border: 1px solid #99d6e0; border-radius: 8px; padding: 10px 14px; font-size: 13px; }
    .cf-error  { background: #fee2e2; color: #991b1b; border-radius: 8px; padding: 8px 12px; font-size: 12px; }
    .cf-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #1a6b7c; padding: 8px 0 4px; border-bottom: 1px solid #e5e7eb; margin-top: 4px; }
    .cf-row    { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .cf-field  { display: flex; flex-direction: column; gap: 4px; }
    .cf-full   { grid-column: 1 / -1; }
    .cf-field label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: .3px; }
    .cf-field input, .cf-field select { height: 34px; border: 1px solid var(--color-border, #d1d5db); border-radius: 8px; padding: 0 10px; font-size: 13px; outline: none; width: 100%; box-sizing: border-box; background: #fff; }
    .cf-field input:focus, .cf-field select:focus { border-color: #1a6b7c; background: #f0f9fb; }
    .cf-field input:disabled { background: #f9fafb; color: #9ca3af; cursor: not-allowed; }
    .cf-id-row { display: flex; gap: 6px; }
    .cf-id-row input { flex: 1; }
    .cf-hint   { font-size: 11px; color: #9ca3af; }
    .btn-gen   { height: 34px; padding: 0 10px; border: 1px solid #1a6b7c; border-radius: 8px; background: #f0f9fb; color: #1a6b7c; font-size: 12px; cursor: pointer; white-space: nowrap; }
    .btn-gen:disabled { opacity: .5; cursor: not-allowed; }
    .req { color: #ef4444; }

    /* ── Modal footer buttons ───────────────────────────────────── */
    .btn-modal-primary   { background: #1a6b7c; color: #fff; border: none; border-radius: 8px; padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
    .btn-modal-primary:disabled { opacity: .5; cursor: not-allowed; }
    .btn-modal-secondary { background: none; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 16px; font-size: 13px; cursor: pointer; color: #374151; }
    .btn-modal-secondary:hover { background: #f3f4f6; }
  `],
  styleUrl: './profile-list.component.scss',
})
export class ProfileListComponent implements OnInit {
  private svc       = inject(ProfileService);
  private userStore = inject(UserStore);
  private refSvc    = inject(RefDataService);

  grades        = signal<RefDataItem[]>([]);
  disciplines   = signal<RefDataItem[]>([]);
  nogLevels     = signal<RefDataItem[]>([]);
  departments   = signal<RefDataItem[]>([]);
  banks         = signal<RefDataItem[]>([]);
  nationalities = signal<RefDataItem[]>([]);

  readonly statusOptions = STATUS_OPTIONS;
  readonly skeletonRows  = [1, 2, 3, 4, 5];
  protected readonly statusBadge = statusBadge;
  protected readonly avatarUrl   = avatarUrl;

  // ── List state ────────────────────────────────────────────────────────────
  loading    = signal(false);
  rows       = signal<EmployeeListItem[]>([]);
  total      = signal(0);
  totalPages = signal(1);
  page       = signal(0);
  pageSize   = signal(PAGE_SIZE);

  searchTerm   = '';
  filterStatus = '';

  // ── View-user modal (no profile) ──────────────────────────────────────────
  showViewModal = signal(false);
  viewedUser    = signal<EmployeeListItem | null>(null);

  // ── Create-profile modal ──────────────────────────────────────────────────
  showCreateModal = signal(false);
  createTarget    = signal<EmployeeListItem | null>(null);
  creating        = signal(false);
  generatingId    = signal(false);
  createError     = signal<string | null>(null);

  // ── Create form fields ────────────────────────────────────────────────────
  // Emploi
  cfEmployeeId      = '';
  cfHireDate        = '';
  cfContractType    = '';
  cfContractEndDate = '';
  cfProbationEndDate = '';
  cfDepartmentId    : number | null = null;
  cfGradeId         : number | null = null;
  cfDisciplineId    : number | null = null;
  cfNogLevelId      : number | null = null;
  // Identité
  cfGender          = '';
  cfDateOfBirth     = '';
  cfNationalityId   : number | null = null;
  cfNationalId      = '';
  cfPhone           = '';
  cfPersonalEmail   = '';
  cfHomeAddress     = '';
  // Contact urgence
  cfEmergencyName     = '';
  cfEmergencyRelation = '';
  cfEmergencyPhone    = '';
  // Bancaire
  cfBankId   : number | null = null;
  cfRib      = '';
  cfIban     = '';

  // ── Derived ───────────────────────────────────────────────────────────────
  hasActiveFilters = computed(() => !!this.searchTerm || !!this.filterStatus);
  pageStart        = computed(() => this.page() * this.pageSize() + 1);
  pageEnd          = computed(() => Math.min((this.page() + 1) * this.pageSize(), this.total()));

  private search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.reload());
  }

  ngOnInit() { this.reload(); }

  onSearch(term: string) { this.search$.next(term); }

  reload(resetPage = true) {
    if (resetPage) this.page.set(0);
    this.loading.set(true);

    const filter: ProfileFilter = {
      status: (this.filterStatus || undefined) as ProfileFilter['status'],
      search: this.searchTerm || undefined,
    };

    this.svc
      .listAllEmployees(filter, this.page(), this.pageSize())
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        this.loading.set(false);
        if (res) {
          this.rows.set(res.content);
          this.total.set(res.totalElements);
          this.totalPages.set(res.totalPages);
        }
      });
  }

  goPage(p: number) {
    this.page.set(p);
    this.reload(false);
  }

  clearFilters() {
    this.searchTerm   = '';
    this.filterStatus = '';
    this.reload();
  }

  /** Returns 2-letter initials from a full name. */
  initials(name: string | null | undefined): string {
    const parts = (name ?? '?').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
    return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase() || '?';
  }

  // ── View-user modal ───────────────────────────────────────────────────────
  openViewUser(row: EmployeeListItem): void {
    this.viewedUser.set(row);
    this.showViewModal.set(true);
  }

  // ── Create-profile modal ──────────────────────────────────────────────────
  openCreateProfile(row: EmployeeListItem): void {
    this.createTarget.set(row);
    // Pre-fill from existing user data
    this.cfEmployeeId       = row.employeeId ?? '';
    this.cfGender           = row.gender ?? '';
    // Reset ID fields to null
    this.cfGradeId          = null;
    this.cfDisciplineId     = null;
    this.cfNogLevelId       = null;
    this.cfDepartmentId     = null;
    this.cfNationalityId    = null;
    this.cfBankId           = null;
    // Reset text fields
    this.cfHireDate         = '';
    this.cfContractType     = '';
    this.cfContractEndDate  = '';
    this.cfProbationEndDate = '';
    this.cfDateOfBirth      = '';
    this.cfNationalId       = '';
    this.cfPhone            = '';
    this.cfPersonalEmail    = '';
    this.cfHomeAddress      = '';
    this.cfEmergencyName    = '';
    this.cfEmergencyRelation = '';
    this.cfEmergencyPhone   = '';
    this.cfRib              = '';
    this.cfIban             = '';
    this.createError.set(null);
    this.showCreateModal.set(true);
    // Load ref data dropdowns
    const paysId = row.paysId ?? this.userStore.currentUser()?.paysId ?? 179;
    this.refSvc.getGrades(paysId).subscribe(r => this.grades.set(r));
    this.refSvc.getDisciplines(paysId).subscribe(r => this.disciplines.set(r));
    this.refSvc.getNogLevels(paysId).subscribe(r => this.nogLevels.set(r));
    this.refSvc.getDepartments(paysId).subscribe(r => this.departments.set(r));
    this.refSvc.getBanks(paysId).subscribe(r => this.banks.set(r));
    this.refSvc.getNationalities().subscribe(r => this.nationalities.set(r));
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.createTarget.set(null);
    this.createError.set(null);
  }

  submitCreate(): void {
    const target = this.createTarget();
    if (!target) return;
    this.createError.set(null);

    if (!this.cfHireDate)          { this.createError.set("La date d'embauche est obligatoire."); return; }
    if (!this.cfContractType)      { this.createError.set("Le type de contrat est obligatoire."); return; }
    if (this.cfContractType === 'FIXED_TERM' && !this.cfContractEndDate) {
      this.createError.set("La date de fin de contrat est obligatoire pour un CDD."); return;
    }

    const dto: Record<string, unknown> = {
      userId:       target.userId,
      paysId:       target.paysId,
      employeeId:   'PENDING', // matricule généré automatiquement lors du provisioning IT
      hireDate:     this.cfHireDate,
      contractType: this.cfContractType,
    };
    // Optional fields — only include if filled
    if (this.cfContractEndDate)   dto['contractEndDate']  = this.cfContractEndDate;
    if (this.cfProbationEndDate)  dto['probationEndDate'] = this.cfProbationEndDate;
    if (this.cfGradeId != null)      dto['gradeId']      = this.cfGradeId;
    if (this.cfDisciplineId != null) dto['disciplineId'] = this.cfDisciplineId;
    if (this.cfNogLevelId != null)   dto['nogLevelId']   = this.cfNogLevelId;
    if (this.cfDepartmentId != null) dto['departmentId'] = this.cfDepartmentId;
    if (this.cfNationalityId != null)dto['nationalityId']= this.cfNationalityId;
    if (this.cfBankId != null)       dto['bankId']       = this.cfBankId;
    if (this.cfGender)            dto['gender']           = this.cfGender;
    if (this.cfDateOfBirth)       dto['dateOfBirth']      = this.cfDateOfBirth;
    if (this.cfNationalId)        dto['nationalId']       = this.cfNationalId;
    if (this.cfPhone)             dto['phone']            = this.cfPhone;
    if (this.cfPersonalEmail)     dto['personalEmail']    = this.cfPersonalEmail;
    if (this.cfHomeAddress)       dto['homeAddress']      = this.cfHomeAddress;
    if (this.cfEmergencyName)     dto['emergencyContactName']     = this.cfEmergencyName;
    if (this.cfEmergencyRelation) dto['emergencyContactRelation'] = this.cfEmergencyRelation;
    if (this.cfEmergencyPhone)    dto['emergencyContactPhone']    = this.cfEmergencyPhone;
    if (this.cfRib)               dto['rib']              = this.cfRib;
    if (this.cfIban)              dto['iban']             = this.cfIban;

    this.creating.set(true);
    this.svc.create(dto as any).subscribe({
      next: (profile) => {
        this.creating.set(false);
        this.closeCreateModal();
        // Update row in-place → "Créer profil" button becomes "Modifier"
        this.rows.update(rs => rs.map(r =>
          r.userId === target.userId
            ? { ...r, profileId: (profile as any).id, hasProfile: true,
                lifecycleStatus: (profile as any).lifecycleStatus ?? 'PRE_ONBOARDING',
                contractType: this.cfContractType }
            : r
        ));
      },
      error: (err) => {
        this.creating.set(false);
        const msg = err?.error?.message ?? err?.error?.errors?.[0]?.message
                  ?? err?.error?.detail ?? 'Erreur lors de la création du profil.';
        this.createError.set(msg);
      },
    });
  }
}
