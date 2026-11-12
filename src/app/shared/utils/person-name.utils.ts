/**
 * Puts a full name in the "Prénom NOM" form: the last word in capitals, every other
 * word with a leading capital (also after - and ').
 *
 *   'jean ben dupont' → 'Jean Ben DUPONT'
 *   'jean dupont'     → 'Jean DUPONT'
 *
 * With a single field only the last word can be taken as the surname; a single word is
 * a first name. The backend applies the same rule before writing Users.fullName
 * (PersonNameFormatter.java) — keep the two in step.
 */
export function formatPersonName(raw: string | null | undefined): string {
  const words = (raw ?? '').trim().split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => words.length > 1 && i === words.length - 1
      ? w.toLocaleUpperCase('fr')
      : capitalize(w))
    .join(' ');
}

/** Prénom field: every word with a leading capital ('jean-marc ben' → 'Jean-Marc Ben'). */
export function formatFirstName(raw: string | null | undefined): string {
  return (raw ?? '').trim().split(/\s+/).filter(Boolean).map(capitalize).join(' ');
}

/** Nom field: the whole last name in capitals ('ben dupont' → 'BEN DUPONT'). */
export function formatLastName(raw: string | null | undefined): string {
  return (raw ?? '').trim().split(/\s+/).filter(Boolean).join(' ').toLocaleUpperCase('fr');
}

/**
 * Splits a stored "Prénom NOM" back into its two fields. The NOM is the run of words in
 * capitals at the end ('Jean BEN DUPONT' → Jean / BEN DUPONT); a name not yet in that form
 * falls back to its last word ('Jean Ben Dupont' → Jean Ben / Dupont). The first word always
 * stays in the prénom, so 'JEAN DUPONT' → JEAN / DUPONT. Mirrors PersonNameFormatter.compose.
 */
export function splitPersonName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { firstName: words[0] ?? '', lastName: '' };
  let start = words.length;
  while (start > 1 && isUpperWord(words[start - 1])) start--;
  if (start === words.length) start = words.length - 1;
  return { firstName: words.slice(0, start).join(' '), lastName: words.slice(start).join(' ') };
}

/** Has at least one cased letter and none of them lower-case. */
function isUpperWord(word: string): boolean {
  return word !== word.toLocaleLowerCase('fr') && word === word.toLocaleUpperCase('fr');
}

function capitalize(word: string): string {
  let out = '';
  let upNext = true;
  for (const ch of word.toLocaleLowerCase('fr')) {
    out += upNext ? ch.toLocaleUpperCase('fr') : ch;
    upNext = ch === '-' || ch === '\'' || ch === '’';
  }
  return out;
}
