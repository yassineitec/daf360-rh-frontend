import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Tout ce qui décrit la liste des candidats (`/rh/candidates/list`) telle que l'utilisateur l'a laissée. */
export interface CandidateListState {
  search:           string;
  statusFilter:     string;
  departmentFilter: string;
  demandFilter:     string;
  createdRange:     Date[] | null;
  sort:             string | null;
  page:             number;
  pageSize:         number;
}

/**
 * Zone où les filtres survivent : la liste (`candidates/list`) et la fiche d'un candidat
 * qu'elle ouvre (`candidates/42`). Sans préfixe fixe, pour valoir sous le shell
 * (`/rh/candidates/list`) comme en app servie seule (`/candidates/list`).
 */
const CANDIDATE_LIST_ZONE = /\/candidates\/(list|\d+)$/;

/**
 * Mémorise les filtres de la liste des candidats pour que le retour depuis la fiche d'un
 * candidat retrouve la liste telle qu'on l'a quittée.
 *
 * Volontairement en mémoire seulement : un rechargement (F5) repart d'une liste propre.
 * Et toute navigation hors de la zone liste / fiche efface l'état — revenir par le menu
 * après être passé ailleurs ne ramène pas l'ancien filtre.
 */
@Injectable({ providedIn: 'root' })
export class CandidateListStateService {
  private state: CandidateListState | null = null;

  constructor() {
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (!CANDIDATE_LIST_ZONE.test(path)) this.state = null;
      });
  }

  save(state: CandidateListState): void {
    this.state = state;
  }

  restore(): CandidateListState | null {
    return this.state;
  }
}
