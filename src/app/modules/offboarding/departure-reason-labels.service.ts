import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { ConfigurableListService } from '../../core/lists/configurable-list.service';
import { ListValue } from '../../core/lists/configurable-list.model';
import { adminLabel } from '../../shared/utils/admin-label.utils';

/**
 * Offboarding departure-reason code → its value in Admin › Listes configurables ›
 * CONTRACT_END_REASON. The offboarding codes stay what the backend stores and branches on
 * (PDF wording, workflow); only the displayed text comes from the admin list.
 * AUTRE has no counterpart, so it keeps its i18n label.
 */
const ADMIN_CODE: Record<string, string> = {
  RESIGNATION:  'DEMISSION',
  FIN_CONTRAT:  'TERME_ECHU',
  LICENCIEMENT: 'LICENCIEMENT',
  RETRAITE:     'RETRAITE',
  FIN_STAGE:    'FIN_STAGE',
  FIN_MISSION:  'FIN_MISSION',
};

@Injectable({ providedIn: 'root' })
export class DepartureReasonLabelService {
  private translate = inject(TranslateService);
  private listSvc   = inject(ConfigurableListService);

  private readonly values = toSignal(
    this.listSvc.getListValues('CONTRACT_END_REASON').pipe(catchError(() => of([] as ListValue[]))),
    { initialValue: [] as ListValue[] });

  /**
   * Label in the UI language: the admin label when the list holds the reason, the
   * OFFBOARDING.REASON.* translation otherwise. Reads signals, so a template or `computed`
   * calling it follows both the list loading and a language switch.
   */
  label(code: string | null | undefined): string {
    if (!code) return '';
    this.translate.currentLang();
    const adminCode = ADMIN_CODE[code];
    const value = adminCode ? this.values().find(v => v.valueCode === adminCode) : undefined;
    return value ? adminLabel(value, this.translate) : this.translate.instant('OFFBOARDING.REASON.' + code);
  }
}
