import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PipelineTableSort } from '../sections/pipeline-table-section.component';

/** Tout ce qui décrit le tableau des candidatures (`/rh/candidates`) tel que l'utilisateur l'a laissé. */
export interface PipelineState {
  viewMode:          'kanban' | 'list';
  search:            string;
  stageFilter:       string;
  demandFilter:      string;
  minFitFilter:      string;
  urgentOnly:        boolean;
  columnSortDirs:    Record<string, 'asc' | 'desc'>;
  mobileStageFilter: string | null;
  listSort:          PipelineTableSort | null;
}

/**
 * Zone où les filtres survivent : la page (`candidates`) et la fiche d'un candidat
 * (`candidates/42`). Sans préfixe fixe, pour valoir sous le shell (`/rh/candidates`)
 * comme en app servie seule (`/candidates`). `candidates/new` et `candidates/list` sont
 * d'autres pages : elles effacent l'état.
 */
const CANDIDATES_ZONE = /\/candidates(\/\d+)?$/;

/**
 * Mémorise les filtres du tableau des candidatures pour que le retour depuis la fiche
 * d'un candidat (fil d'Ariane) retrouve la page telle qu'on l'a quittée.
 *
 * Volontairement en mémoire seulement : un rechargement (F5) repart d'une page propre.
 * Et toute navigation hors de la zone page / fiche efface l'état — revenir par le menu
 * après être passé ailleurs (y compris par `/rh/recrutement`) ne ramène pas l'ancien filtre.
 */
@Injectable({ providedIn: 'root' })
export class PipelineStateService {
  private state: PipelineState | null = null;

  constructor() {
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (!CANDIDATES_ZONE.test(path)) this.state = null;
      });
  }

  save(state: PipelineState): void {
    this.state = state;
  }

  restore(): PipelineState | null {
    return this.state;
  }
}
