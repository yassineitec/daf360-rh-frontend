import { TranslateService } from '@ngx-translate/core';

import { ListValue } from '../../core/lists/configurable-list.model';
import { adminLabel } from '../../shared/utils/admin-label.utils';
import { RecruitmentDemandSummary } from './recruitment-demand.model';

/*
 * A demand summary carries its labels in French only (the backend's `*Label` fields), plus
 * `departmentLabelEn`. These put them in the UI language for the cards and the table — the
 * same rules as the detail page and the validation filters. All read `translate.currentLang()`,
 * so a `computed` calling them re-labels on a language switch.
 */

/** Department in the UI language — `department` stays the French filter value. */
export function demandDepartmentLabel(d: RecruitmentDemandSummary, translate: TranslateService): string {
  return (translate.currentLang() === 'en' && d.departmentLabelEn) || d.department || '';
}

/** Recruitment reason — an enum, translated with the same keys as the create form. */
export function demandReasonLabel(d: RecruitmentDemandSummary, translate: TranslateService): string {
  if (!d.recruitmentReason) return d.recruitmentReasonLabel ?? '';
  const key = `RECRUITMENT_DEMANDS.FORM.REASON.${d.recruitmentReason}_LABEL`;
  const text = translate.instant(key);
  return text !== key ? text : (d.recruitmentReasonLabel ?? '');
}

/** Urgency — the summary only has the French label, matched against rh/admin URGENCY_LEVEL. */
export function demandUrgencyLabel(
  d: RecruitmentDemandSummary, levels: ListValue[], translate: TranslateService,
): string {
  if (!d.urgencyLevelLabel) return '';
  const level = levels.find(l => l.labelFr === d.urgencyLevelLabel);
  return level ? adminLabel(level, translate) : d.urgencyLevelLabel;
}
