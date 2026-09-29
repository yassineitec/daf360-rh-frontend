import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { AdminService } from './admin.service';
import {
  DEFAULT_HOLIDAY_CALENDAR_CONFIG,
  HOLIDAY_CALENDAR_CONFIG_KEY,
  HolidayCalendarConfig,
  ParameterSet,
} from './models/admin.model';
import { FLAG_SVGS } from './flag-svgs';

/** Loaded config plus the `parameter_sets` row id it came from (`null` = none saved yet). */
export interface LoadedHolidayCalendarConfig {
  config:  HolidayCalendarConfig;
  paramId: number | null;
  /**
   * Whether the pays already has other (payroll) parameters. The backend's
   * `POST /parameters/seed` skips any pays with at least one row, so saving this config
   * first on an empty pays would silently stop that seed from ever filling it — the
   * settings modal warns when this is false.
   */
  hasOtherParams: boolean;
}

export const HOLIDAY_ABBREV_MAX_LENGTH = 6;

/**
 * Reads/writes the holiday calendar display settings through the existing
 * `/api/hr/admin/parameters` endpoints, as a single JSON value per pays.
 *
 * The backend does no validation on that value, so every field is checked here on the
 * way in AND out: a hand-edited or corrupted row falls back field by field to the
 * defaults instead of breaking the calendar.
 */
@Injectable({ providedIn: 'root' })
export class HolidayCalendarConfigService {
  private admin = inject(AdminService);

  /**
   * Never errors: reading parameters needs HR_UPDATE_PROFILE or HR_ADMIN_ROLES, and a
   * user who can see the calendar without either just gets the default display.
   */
  load(paysId: number): Observable<LoadedHolidayCalendarConfig> {
    return this.admin.listParameters(paysId).pipe(
      map(params => {
        const row = params.find(p => p.cle?.toUpperCase() === HOLIDAY_CALENDAR_CONFIG_KEY);
        const hasOtherParams = params.some(p => p !== row);
        return row
          ? { config: this.parse(row.valeur), paramId: row.id, hasOtherParams }
          : { config: { ...DEFAULT_HOLIDAY_CALENDAR_CONFIG }, paramId: null, hasOtherParams };
      }),
      // Unknown when unreadable — assume true so no false warning is shown.
      catchError(() => of({ config: { ...DEFAULT_HOLIDAY_CALENDAR_CONFIG }, paramId: null, hasOtherParams: true })),
    );
  }

  /** Creates the row on first save, updates it afterwards. Needs HR_ADMIN_ROLES. */
  save(paysId: number, config: HolidayCalendarConfig, paramId: number | null): Observable<ParameterSet> {
    const dto = {
      paysId,
      cle:         HOLIDAY_CALENDAR_CONFIG_KEY,
      valeur:      JSON.stringify(this.normalize(config)),
      description: 'Affichage du calendrier des jours fériés (drapeau, abréviation, couleur)',
    };
    return paramId != null
      ? this.admin.updateParameter(paramId, dto)
      : this.admin.createParameter(dto);
  }

  private parse(valeur: string): HolidayCalendarConfig {
    try {
      return this.normalize(JSON.parse(valeur));
    } catch {
      return { ...DEFAULT_HOLIDAY_CALENDAR_CONFIG };
    }
  }

  /** Keeps only valid fields; anything else reverts to its default. */
  normalize(raw: unknown): HolidayCalendarConfig {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const d = DEFAULT_HOLIDAY_CALENDAR_CONFIG;

    const iso = typeof r['flagIsoCode'] === 'string' ? r['flagIsoCode'].trim().toLowerCase() : '';
    const abbrev = typeof r['abbrev'] === 'string' ? r['abbrev'].trim() : '';
    const color = typeof r['color'] === 'string' ? r['color'].trim().toLowerCase() : '';

    return {
      showFlag:    typeof r['showFlag'] === 'boolean' ? r['showFlag'] : d.showFlag,
      flagIsoCode: FLAG_SVGS[iso] ? iso : d.flagIsoCode,
      abbrev:      abbrev && abbrev.length <= HOLIDAY_ABBREV_MAX_LENGTH ? abbrev : d.abbrev,
      color:       /^#[0-9a-f]{6}$/.test(color) ? color : d.color,
    };
  }
}
