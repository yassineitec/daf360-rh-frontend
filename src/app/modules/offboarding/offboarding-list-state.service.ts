import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { DepartureReason } from './models/offboarding.model';
import { OffboardingSort } from './sections/offboarding-table-section.component';

/** Tout ce qui décrit la liste des offboardings telle que l'utilisateur l'a laissée. */
export interface OffboardingListState {
  /**
   * Le motif de la page d'où l'état vient (`type/:reason`), ou null sur la page complète.
   * L'état n'est restauré que sur la même page : celui de « Démission » n'a rien à faire
   * sur la liste complète, et inversement.
   */
  scope:        DepartureReason | null;
  viewMode:     'kanban' | 'list';
  search:       string;
  statusFilter: string;
  reasonFilter: string;
  lastDayRange: Date[] | null;
  lateOnly:     boolean;
  tableSort:    OffboardingSort | null;
  columnSort:   Record<string, 'asc' | 'desc'>;
  page:         number;
  pageSize:     number;
}

/**
 * Zone où les filtres survivent : la liste (`offboarding`), la liste d'un motif
 * (`offboarding/type/RESIGNATION`) et la fiche d'un dossier (`offboarding/42`). Sans
 * préfixe fixe, pour valoir sous le shell (`/rh/offboarding`) comme en app servie seule.
 */
const OFFBOARDING_ZONE = /\/offboarding(\/type\/[A-Z_]+|\/\d+)?$/;

/**
 * Mémorise les filtres de la liste des offboardings pour que le retour depuis un dossier
 * (fil d'Ariane) retrouve la liste telle qu'on l'a quittée.
 *
 * Volontairement en mémoire seulement : un rechargement (F5) repart d'une liste propre.
 * Et toute navigation hors de la zone liste / dossier efface l'état — revenir par le menu
 * après être passé ailleurs ne ramène pas l'ancien filtre.
 */
@Injectable({ providedIn: 'root' })
export class OffboardingListStateService {
  private state: OffboardingListState | null = null;

  constructor() {
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (!OFFBOARDING_ZONE.test(path)) this.state = null;
      });
  }

  save(state: OffboardingListState): void {
    this.state = state;
  }

  /** L'état de la page `scope`, ou null s'il n'y en a pas — ou s'il vient d'une autre page. */
  restore(scope: DepartureReason | null): OffboardingListState | null {
    return this.state && this.state.scope === scope ? this.state : null;
  }
}
