import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Tout ce qui décrit l'annuaire des profils tel que l'utilisateur l'a laissé. */
export interface ProfileListState {
  searchText: string;
  /** Filtres du panneau, à plat (`hireDate` en `from..to`) — voir `ProfileListComponent.filters`. */
  filters:    Partial<Record<string, string>>;
  sort:       string | null;
  page:       number;
  pageSize:   number;
  viewMode:   'grid' | 'list';
}

/**
 * Zone où les filtres survivent : la liste (`profiles`), la fiche d'un profil
 * (`profiles/42`) et la création du dossier d'un utilisateur qui n'en a pas
 * (`profiles/user/7`). Sans préfixe fixe, pour valoir sous le shell (`/rh/profiles`)
 * comme en app servie seule (`/profiles`).
 */
const PROFILES_ZONE = /\/profiles(\/\d+|\/user\/\d+)?$/;

/**
 * Mémorise les filtres de l'annuaire pour que le retour depuis une fiche (fil d'Ariane)
 * retrouve la liste telle qu'on l'a quittée.
 *
 * Volontairement en mémoire seulement : un rechargement (F5) repart d'une liste propre.
 * Et toute navigation hors de la zone liste / fiche efface l'état — revenir par le menu
 * après être passé ailleurs ne ramène pas l'ancien filtre.
 */
@Injectable({ providedIn: 'root' })
export class ProfileListStateService {
  private state: ProfileListState | null = null;

  constructor() {
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (!PROFILES_ZONE.test(path)) this.state = null;
      });
  }

  save(state: ProfileListState): void {
    this.state = state;
  }

  restore(): ProfileListState | null {
    return this.state;
  }
}
