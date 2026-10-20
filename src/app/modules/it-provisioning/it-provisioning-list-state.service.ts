import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ProvisioningSort } from './sections/it-provisioning-table-section.component';

/** Tout ce qui décrit la liste des provisionnements IT telle que l'utilisateur l'a laissée. */
export interface ItProvisioningListState {
  viewMode:      'grid' | 'list';
  search:        string;
  statusFilter:  string;
  overdueOnly:   boolean;
  missingFilter: ('HARDWARE' | 'LICENCES' | 'EMAIL')[];
  startRange:    Date[] | null;
  profileFilter:  string[];
  positionFilter: string[];
  sort:          ProvisioningSort | null;
  page:          number;
  pageSize:      number;
}

/**
 * Zone où les filtres survivent : la liste (`it-provisioning`) et la fiche d'un dossier
 * (`it-provisioning/42`). Sans préfixe fixe, pour valoir sous le shell
 * (`/rh/it-provisioning`) comme en app servie seule (`/it-provisioning`).
 */
const IT_PROVISIONING_ZONE = /\/it-provisioning(\/\d+)?$/;

/**
 * Mémorise les filtres de la liste des provisionnements IT pour que le retour depuis un
 * dossier (fil d'Ariane, bouton Retour) retrouve la liste telle qu'on l'a quittée.
 *
 * Volontairement en mémoire seulement : un rechargement (F5) repart d'une liste propre.
 * Et toute navigation hors de la zone liste / dossier efface l'état — revenir par le menu
 * après être passé ailleurs ne ramène pas l'ancien filtre.
 */
@Injectable({ providedIn: 'root' })
export class ItProvisioningListStateService {
  private state: ItProvisioningListState | null = null;

  constructor() {
    inject(Router).events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        const path = e.urlAfterRedirects.split(/[?#]/)[0];
        if (!IT_PROVISIONING_ZONE.test(path)) this.state = null;
      });
  }

  save(state: ItProvisioningListState): void {
    this.state = state;
  }

  restore(): ItProvisioningListState | null {
    return this.state;
  }
}
