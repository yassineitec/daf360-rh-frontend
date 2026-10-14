import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Tout ce qui décrit la page Recrutement telle que l'utilisateur l'a laissée. */
export interface RecrutementState {
  viewMode:          'kanban' | 'list';
  search:            string;
  statusFilter:      string;
  departmentFilter:  string;
  demandFilter:      string;
  createdRange:      Date[] | null;
  sort:              string | null;
  page:              number;
  pageSize:          number;
  columnSortDirs:    Record<string, 'asc' | 'desc'>;
  mobileStageFilter: string | null;
}

/**
 * Zone où les filtres survivent : la page (`recrutement`) et la fiche d'un candidat
 * qu'elle ouvre (`candidates/42`). Sans préfixe fixe, pour valoir sous le shell
 * (`/rh/recrutement`) comme en app servie seule (`/recrutement`).
 */
const RECRUTEMENT_ZONE = /\/(recrutement|candidates\/\d+)$/;

/**
 * Mémorise les filtres de la page Recrutement pour que le retour depuis la fiche d'un
 * candidat retrouve la page telle qu'on l'a quittée.
 *
 * Volontairement en mémoire seulement : un rechargement (F5) repart d'une page propre.
 * Et toute navigation hors de la zone page / fiche efface l'état — revenir par le menu
 * après être passé ailleurs (y compris par `/rh/candidates`) ne ramène pas l'ancien filtre.
 */
@Injectable({ providedIn: 'root' })
export class RecrutementStateService {
  private state: RecrutementState | null = null;

  constructor() {
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (!RECRUTEMENT_ZONE.test(path)) this.state = null;
      });
  }

  save(state: RecrutementState): void {
    this.state = state;
  }

  restore(): RecrutementState | null {
    return this.state;
  }
}
