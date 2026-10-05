import { SortDirection } from '@khalilrebhiitec/daf360';

/** A `daf-data-table` header sort as a page holds it — `null` = the list's natural order. */
export interface TableSort {
  key: string;
  dir: 'asc' | 'desc';
}

/** What one column sorts on. `null` means "no value" and always sorts last. */
export type SortValueFn<T> = (item: T) => string | number | null | undefined;

/** The `(sortChange)` payload as a page-held sort (`dir: null` = sort cleared). */
export function toTableSort(key: string, dir: SortDirection): TableSort | null {
  return key && dir ? { key, dir } : null;
}

/** Position in a fixed order (a workflow, a priority); an unknown value is "no value". */
export function rankIn<V>(order: readonly V[], value: V): number | null {
  const i = order.indexOf(value);
  return i < 0 ? null : i;
}

/**
 * Sorts a whole list for a `manualSort` table — the table only ever holds one page, so a
 * page that paginates client-side sorts the full filtered list here and slices after.
 *
 * Same rules as the library's own comparator: empty values last in both directions, numbers
 * as numbers, text "naturally" (`item2` before `item10`, accents ignored). An unknown key
 * leaves the list untouched.
 */
export function sortByColumn<T>(
  items: readonly T[],
  sort: TableSort | null,
  values: Record<string, SortValueFn<T>>,
): T[] {
  const value = sort && values[sort.key];
  if (!sort || !value) return [...items];
  const sign = sort.dir === 'asc' ? 1 : -1;
  const isEmpty = (v: unknown) => v === null || v === undefined || v === '';
  return [...items].sort((a, b) => {
    const va = value(a), vb = value(b);
    const ea = isEmpty(va), eb = isEmpty(vb);
    if (ea || eb) return ea && eb ? 0 : ea ? 1 : -1;
    const cmp = typeof va === 'number' && typeof vb === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true });
    return cmp * sign;
  });
}

/**
 * Client-side text search over a table's rows: keeps the rows where **every word** of `query`
 * appears in at least one of the given texts (case- and accent-insensitive). `texts` returns
 * what the reader actually sees in the row (labels, formatted dates…), not raw ids or enums.
 *
 * Used by the `daf-search-toolbar` placed above the admin tables: the toolbar carries `[table]`
 * (reset + column picker right of Filtres) and its search really filters through this.
 */
export function searchRows<T>(items: readonly T[], query: string, texts: (item: T) => unknown[]): T[] {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const words = norm(query.trim()).split(/\s+/).filter(Boolean);
  if (!words.length) return [...items];
  return items.filter(item => {
    const hay = norm(texts(item).filter(v => v != null && v !== '').map(String).join(' '));
    return words.every(w => hay.includes(w));
  });
}
