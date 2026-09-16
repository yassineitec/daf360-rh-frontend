/**
 * Moved to `shared/detail/field-bridges.ts` — `/rh/candidates/:id` grew the same
 * inline edit mode and needs the same bridges, and a candidate section importing
 * them out of the profiles module would have been the wrong dependency.
 *
 * Re-exported from here so the dozen existing `./field-bridges` imports in this
 * folder keep working.
 */
export {
  fmtDate, toSelected, fromSelected, asText, asNumber, toDate, fromDate,
} from '../../../shared/detail/field-bridges';
