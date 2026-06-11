/**
 * Pure unit tests for PermissionChecklistStore.
 * No Angular context — the class has no DI dependencies.
 */
import { PermissionChecklistStore, ALL_PERMISSIONS } from '../models/admin.model';

describe('PermissionChecklistStore', () => {

  // ── Initial state ─────────────────────────────────────────────────────────

  it('starts empty when no initial permissions given', () => {
    const store = new PermissionChecklistStore();
    expect(store.count()).toBe(0);
    expect(store.getSelected()).toEqual([]);
  });

  it('starts with the provided initial permissions', () => {
    const init = ['GET_USERS', 'GET_LEAVES'];
    const store = new PermissionChecklistStore(init);
    expect(store.count()).toBe(2);
    expect(store.isSelected('GET_USERS')).toBe(true);
    expect(store.isSelected('GET_LEAVES')).toBe(true);
  });

  // ── toggle ────────────────────────────────────────────────────────────────

  it('toggle — adds a permission not yet selected', () => {
    const store = new PermissionChecklistStore();
    store.toggle('MANAGE_EVENTS');
    expect(store.isSelected('MANAGE_EVENTS')).toBe(true);
    expect(store.count()).toBe(1);
  });

  it('toggle — removes an already-selected permission', () => {
    const store = new PermissionChecklistStore(['MANAGE_EVENTS']);
    store.toggle('MANAGE_EVENTS');
    expect(store.isSelected('MANAGE_EVENTS')).toBe(false);
    expect(store.count()).toBe(0);
  });

  it('toggle — toggling twice restores original state', () => {
    const store = new PermissionChecklistStore();
    store.toggle('GET_ROLES');
    store.toggle('GET_ROLES');
    expect(store.isSelected('GET_ROLES')).toBe(false);
  });

  // ── selectAll ─────────────────────────────────────────────────────────────

  it('selectAll — selects all 32 permissions', () => {
    const store = new PermissionChecklistStore();
    store.selectAll(ALL_PERMISSIONS);
    expect(store.count()).toBe(ALL_PERMISSIONS.length);
    for (const p of ALL_PERMISSIONS) {
      expect(store.isSelected(p)).toBe(true);
    }
  });

  it('selectAll — does not duplicate existing selections', () => {
    const store = new PermissionChecklistStore(['GET_ROLES']);
    store.selectAll(['GET_ROLES', 'GET_USERS']);
    expect(store.count()).toBe(2);
  });

  // ── clearAll ──────────────────────────────────────────────────────────────

  it('clearAll — removes all selections', () => {
    const store = new PermissionChecklistStore(ALL_PERMISSIONS.slice(0, 5));
    store.clearAll();
    expect(store.count()).toBe(0);
    expect(store.getSelected()).toEqual([]);
  });

  // ── isSelected ────────────────────────────────────────────────────────────

  it('isSelected returns false for a permission not in the set', () => {
    const store = new PermissionChecklistStore(['GET_USERS']);
    expect(store.isSelected('CREATE_USER')).toBe(false);
  });

  it('isSelected returns true after toggle adds it', () => {
    const store = new PermissionChecklistStore();
    store.toggle('VIEW_DASHBOARD');
    expect(store.isSelected('VIEW_DASHBOARD')).toBe(true);
  });

  // ── getSelected ───────────────────────────────────────────────────────────

  it('getSelected — returns sorted array', () => {
    const store = new PermissionChecklistStore(['GET_USERS', 'CREATE_USER', 'MANAGE_EVENTS']);
    const result = store.getSelected();
    expect(result).toEqual([...result].sort());
  });

  it('getSelected — reflects changes after toggle', () => {
    const store = new PermissionChecklistStore(['GET_USERS']);
    store.toggle('CREATE_USER');
    expect(store.getSelected()).toContain('CREATE_USER');
    store.toggle('GET_USERS');
    expect(store.getSelected()).not.toContain('GET_USERS');
  });

  // ── isDirty ───────────────────────────────────────────────────────────────

  it('isDirty — false when selection matches original', () => {
    const orig  = ['GET_ROLES', 'GET_USERS'];
    const store = new PermissionChecklistStore(orig);
    expect(store.isDirty(orig)).toBe(false);
  });

  it('isDirty — true when a permission is added', () => {
    const orig  = ['GET_ROLES'];
    const store = new PermissionChecklistStore(orig);
    store.toggle('GET_USERS');
    expect(store.isDirty(orig)).toBe(true);
  });

  it('isDirty — true when a permission is removed', () => {
    const orig  = ['GET_ROLES', 'GET_USERS'];
    const store = new PermissionChecklistStore(orig);
    store.toggle('GET_ROLES');
    expect(store.isDirty(orig)).toBe(true);
  });

  it('isDirty — false after clearAll then selectAll with same permissions', () => {
    const orig  = ['GET_ROLES', 'GET_USERS'];
    const store = new PermissionChecklistStore(orig);
    store.clearAll();
    store.selectAll(orig);
    expect(store.isDirty(orig)).toBe(false);
  });

  // ── init ──────────────────────────────────────────────────────────────────

  it('init — replaces current selection with new array', () => {
    const store = new PermissionChecklistStore(['GET_ROLES']);
    store.init(['GET_USERS', 'CREATE_USER']);
    expect(store.isSelected('GET_ROLES')).toBe(false);
    expect(store.isSelected('GET_USERS')).toBe(true);
    expect(store.count()).toBe(2);
  });

  // ── count ─────────────────────────────────────────────────────────────────

  it('count tracks the number of selected permissions accurately', () => {
    const store = new PermissionChecklistStore();
    expect(store.count()).toBe(0);
    store.toggle('A'); expect(store.count()).toBe(1);
    store.toggle('B'); expect(store.count()).toBe(2);
    store.toggle('A'); expect(store.count()).toBe(1);
    store.clearAll();  expect(store.count()).toBe(0);
  });
});
