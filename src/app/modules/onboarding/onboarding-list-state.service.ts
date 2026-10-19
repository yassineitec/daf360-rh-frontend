import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { OnboardingSort } from './sections/onboarding-table-section.component';

/** Tout ce qui décrit la liste des onboardings en attente telle que l'utilisateur l'a laissée. */
export interface OnboardingListState {
  viewMode:        'grid' | 'list';
  search:          string;
  statusFilter:    string;
  draftFilter:     '' | 'WITH_DRAFT' | 'NO_DRAFT';
  startRange:      Date[] | null;
  entityFilter:    string;
  startPassedOnly: boolean;
  sort:            OnboardingSort | null;
  page:            number;
  pageSize:        number;
}

/**
 * Zone où les filtres survivent : la liste (`onboarding`), l'assistant d'un candidat
 * (`onboarding/42`) et la page de succès qui le suit (`onboarding/success`), d'où l'on
 * revient à la liste. Sans préfixe fixe, pour valoir sous le shell (`/rh/onboarding`)
 * comme en app servie seule (`/onboarding`).
 */
const ONBOARDING_ZONE = /\/onboarding(\/\d+|\/success)?$/;

/**
 * Mémorise les filtres de la liste des onboardings pour que le retour depuis l'assistant
 * d'un candidat retrouve la liste telle qu'on l'a quittée.
 *
 * Volontairement en mémoire seulement : un rechargement (F5) repart d'une liste propre.
 * Et toute navigation hors de la zone liste / assistant efface l'état — revenir par le
 * menu après être passé ailleurs ne ramène pas l'ancien filtre.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingListStateService {
  private state: OnboardingListState | null = null;

  constructor() {
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (!ONBOARDING_ZONE.test(path)) this.state = null;
      });
  }

  save(state: OnboardingListState): void {
    this.state = state;
  }

  restore(): OnboardingListState | null {
    return this.state;
  }
}
