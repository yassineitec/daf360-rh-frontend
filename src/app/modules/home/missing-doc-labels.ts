import { TranslateService } from '@ngx-translate/core';

/** What the card and the pop-up both carry (MissingDocumentDto / MissingDocAlert). */
interface WithMissingDocs {
  missingDocs: string[];
  missingDocLabels?: string[];
}

/**
 * Display labels of an employee's missing documents, in the UI language.
 *
 * The API sends the codes plus the country's `label_fr` (document_types). That label wins in
 * French when it is a real label — RH may have renamed a type for their country. Otherwise
 * (English / Arabic UI, or a country with no catalogue where the API echoes the code back),
 * the shared `PROFILES.DOC_TYPES.*` translation is used, then the API label, then the code.
 */
export function missingDocLabels(translate: TranslateService, d: WithMissingDocs): string[] {
  const lang = (translate.currentLang() ?? 'fr').toLowerCase();
  return d.missingDocs.map((code, i) => {
    const dbLabel = d.missingDocLabels?.[i]?.trim();
    const custom  = dbLabel && dbLabel !== code ? dbLabel : null;
    if (lang.startsWith('fr') && custom) return custom;
    const key = 'PROFILES.DOC_TYPES.' + code;
    const translated = translate.instant(key);
    // ngx-translate echoes the key back when it is missing.
    if (translated && translated !== key) return translated;
    return custom ?? code;
  });
}
