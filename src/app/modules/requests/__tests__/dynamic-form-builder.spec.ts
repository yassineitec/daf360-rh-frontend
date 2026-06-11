/**
 * Unit tests for the dynamic form builder functions in request.model.ts.
 * Pure functions — no Angular context needed, no TestBed.
 */
import {
  getFieldsForType, isFileField, TYPE_FIELDS,
  COMMENT_FIELD, FieldDef, CATEGORY_LABELS,
} from '../models/request.model';

// ── getFieldsForType ─────────────────────────────────────────────────────────

describe('getFieldsForType', () => {

  it('always appends the universal comment field', () => {
    const fields = getFieldsForType('CHANGEMENT_ADRESSE');
    const last = fields[fields.length - 1];
    expect(last.key).toBe('comment');
    expect(last.required).toBe(false);
  });

  it('CHANGEMENT_ADRESSE → one specific field + comment', () => {
    const fields = getFieldsForType('CHANGEMENT_ADRESSE');
    expect(fields.length).toBe(2);
    expect(fields[0].key).toBe('newValue');
    expect(fields[0].type).toBe('textarea');
    expect(fields[0].required).toBe(true);
  });

  it('CHANGEMENT_EMAIL → email field + comment', () => {
    const fields = getFieldsForType('CHANGEMENT_EMAIL');
    const emailField = fields.find(f => f.key === 'newValue');
    expect(emailField).toBeTruthy();
    expect(emailField!.type).toBe('email');
    expect(emailField!.required).toBe(true);
  });

  it('CHANGEMENT_TELEPHONE → tel field + comment', () => {
    const fields = getFieldsForType('CHANGEMENT_TELEPHONE');
    const telField = fields.find(f => f.key === 'newValue');
    expect(telField!.type).toBe('tel');
  });

  it('CHANGEMENT_URGENCE → 3 specific fields + comment', () => {
    const fields = getFieldsForType('CHANGEMENT_URGENCE');
    expect(fields.length).toBe(4); // contactName, contactRelation, contactPhone, comment
    const keys = fields.map(f => f.key);
    expect(keys).toContain('contactName');
    expect(keys).toContain('contactRelation');
    expect(keys).toContain('contactPhone');
  });

  it('CHANGEMENT_PHOTO → file field + comment', () => {
    const fields = getFieldsForType('CHANGEMENT_PHOTO');
    const fileField = fields.find(f => f.type === 'file');
    expect(fileField).toBeTruthy();
    expect(fileField!.key).toBe('attachment');
  });

  it('MISE_A_JOUR_BANCAIRE → bankName + IBAN + rib + file + comment', () => {
    const fields = getFieldsForType('MISE_A_JOUR_BANCAIRE');
    const keys = fields.map(f => f.key);
    expect(keys).toContain('bankName');
    expect(keys).toContain('iban');
    expect(keys).toContain('rib');
    expect(keys).toContain('attachment');
    expect(keys).toContain('comment');
  });

  it('MISE_A_JOUR_BANCAIRE → IBAN type is "iban"', () => {
    const fields = getFieldsForType('MISE_A_JOUR_BANCAIRE');
    const ibanField = fields.find(f => f.key === 'iban');
    expect(ibanField!.type).toBe('iban');
  });

  it('DEMANDE_FORMATION → formationTitle required, motivation required', () => {
    const fields = getFieldsForType('DEMANDE_FORMATION');
    const title = fields.find(f => f.key === 'formationTitle');
    const motivation = fields.find(f => f.key === 'motivation');
    expect(title!.required).toBe(true);
    expect(motivation!.required).toBe(true);
  });

  it('MUTATION_INTERNE → targetDept required, motivation required', () => {
    const fields = getFieldsForType('MUTATION_INTERNE');
    expect(fields.find(f => f.key === 'targetDept')!.required).toBe(true);
    expect(fields.find(f => f.key === 'motivation')!.required).toBe(true);
  });

  it('unknown type code → only the comment field', () => {
    const fields = getFieldsForType('ATTESTATION_TRAVAIL');   // DOCUMENT type, no specific fields
    expect(fields.length).toBe(1);
    expect(fields[0].key).toBe('comment');
  });

  it('AUTRE → only the comment field', () => {
    const fields = getFieldsForType('AUTRE');
    expect(fields.length).toBe(1);
    expect(fields[0].key).toBe('comment');
  });
});

// ── isFileField ───────────────────────────────────────────────────────────────

describe('isFileField', () => {

  it('returns true for file type', () => {
    const f: FieldDef = { key: 'x', type: 'file', label: 'X', required: false };
    expect(isFileField(f)).toBe(true);
  });

  it('returns false for text type', () => {
    expect(isFileField({ key: 'x', type: 'text', label: 'X', required: false })).toBe(false);
  });

  it('returns false for email type', () => {
    expect(isFileField({ key: 'x', type: 'email', label: 'X', required: false })).toBe(false);
  });

  it('returns false for iban type', () => {
    expect(isFileField({ key: 'x', type: 'iban', label: 'X', required: false })).toBe(false);
  });

  it('returns false for textarea type', () => {
    expect(isFileField({ key: 'x', type: 'textarea', label: 'X', required: false })).toBe(false);
  });

  it('bank file field IS detected as file', () => {
    const bankFields = getFieldsForType('MISE_A_JOUR_BANCAIRE');
    const files = bankFields.filter(isFileField);
    expect(files.length).toBe(1);
    expect(files[0].key).toBe('attachment');
  });
});

// ── CATEGORY_LABELS ───────────────────────────────────────────────────────────

describe('CATEGORY_LABELS', () => {

  it('has a label for every category', () => {
    const categories = ['DOCUMENT', 'PERSONAL_DATA_CHANGE', 'BANK_DETAILS', 'CAREER', 'OTHER'];
    for (const cat of categories) {
      expect(CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]).toBeTruthy();
    }
  });

  it('BANK_DETAILS label mentions bancaire', () => {
    expect(CATEGORY_LABELS['BANK_DETAILS'].toLowerCase()).toContain('bancaire');
  });
});

// ── TYPE_FIELDS completeness ──────────────────────────────────────────────────

describe('TYPE_FIELDS registry', () => {

  it('every entry has at least one field', () => {
    for (const [code, fields] of Object.entries(TYPE_FIELDS)) {
      expect(fields.length).toBeGreaterThan(0);
    }
  });

  it('every field has a non-empty key and label', () => {
    for (const [, fields] of Object.entries(TYPE_FIELDS)) {
      for (const f of fields) {
        expect(f.key.length).toBeGreaterThan(0);
        expect(f.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('all required fields have non-empty keys', () => {
    for (const [, fields] of Object.entries(TYPE_FIELDS)) {
      const requiredFields = fields.filter(f => f.required);
      for (const f of requiredFields) {
        expect(f.key).toBeTruthy();
      }
    }
  });
});
