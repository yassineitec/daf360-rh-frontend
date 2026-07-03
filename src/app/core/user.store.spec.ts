import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideStore } from '@ngrx/store';
import { MeResponse, rootReducers } from '@khalilrebhiitec/daf360';
import { UserStore } from './user.store';

const MOCK_USER: MeResponse = {
  userId:      42,
  fullName:    'Alice Martin',
  email:       'alice@arx.ing',
  azureUpn:    'alice@arx.ing',
  roleId:      13,
  roleName:    'Administrateur',
  permissions: ['RESPONSE_LEAVE', 'SETTLE_LEAVES', 'GET_GLOBAL_LEAVES', 'GET_ROLES', 'CREATE_ROLE'],
  paysId:      179,
  isoCode:     'TN',
  employeeId:  'ARX-26-0001',
  photoUrl:    null,
};

describe('UserStore', () => {
  let store: UserStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideStore(rootReducers),
      ],
    });
    store = TestBed.inject(UserStore);
    http  = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ── Initial state ─────────────────────────────────────────────────────────

  it('starts with null currentUser', () => {
    expect(store.currentUser()).toBeNull();
  });

  it('starts as not authenticated', () => {
    expect(store.isAuthenticated()).toBe(false);
  });

  it('starts with empty permissions', () => {
    expect(store.permissions()).toEqual([]);
  });

  it('starts as not HR Manager', () => {
    expect(store.isHrManager()).toBe(false);
  });

  it('starts as not Admin', () => {
    expect(store.isAdmin()).toBe(false);
  });

  // ── loadCurrentUser — success ─────────────────────────────────────────────

  it('loadCurrentUser — sets currentUser signal on 200', async () => {
    const promise = store.loadCurrentUser();
    const req = http.expectOne(r => r.url.includes('/api/me'));
    req.flush(MOCK_USER);
    await promise;

    expect(store.currentUser()).toEqual(MOCK_USER);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('loadCurrentUser — permissions computed matches user.permissions', async () => {
    const promise = store.loadCurrentUser();
    http.expectOne(r => r.url.includes('/api/me')).flush(MOCK_USER);
    await promise;

    expect(store.permissions()).toEqual(MOCK_USER.permissions);
  });

  it('loadCurrentUser — isHrManager is true when user has RESPONSE_LEAVE', async () => {
    const promise = store.loadCurrentUser();
    http.expectOne(r => r.url.includes('/api/me')).flush(MOCK_USER);
    await promise;

    expect(store.isHrManager()).toBe(true);
  });

  it('loadCurrentUser — isAdmin is true when user has CREATE_ROLE', async () => {
    const promise = store.loadCurrentUser();
    http.expectOne(r => r.url.includes('/api/me')).flush(MOCK_USER);
    await promise;

    expect(store.isAdmin()).toBe(true);
  });

  it('loadCurrentUser — userInitials computed from fullName', async () => {
    const promise = store.loadCurrentUser();
    http.expectOne(r => r.url.includes('/api/me')).flush(MOCK_USER);
    await promise;

    expect(store.userInitials()).toBe('AM');
  });

  // ── loadCurrentUser — 401 ────────────────────────────────────────────────

  it('loadCurrentUser — stays null on 401 (unauthenticated)', async () => {
    const promise = store.loadCurrentUser();
    http.expectOne(r => r.url.includes('/api/me'))
        .flush({}, { status: 401, statusText: 'Unauthorized' });
    await promise;

    expect(store.currentUser()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('loadCurrentUser — sets error on non-401 server error', async () => {
    const promise = store.loadCurrentUser();
    http.expectOne(r => r.url.includes('/api/me'))
        .flush({}, { status: 500, statusText: 'Internal Server Error' });
    await promise;

    expect(store.error()).toBeTruthy();
  });

  // ── hasPermission ────────────────────────────────────────────────────────

  it('hasPermission — returns true for held permission', async () => {
    const promise = store.loadCurrentUser();
    http.expectOne(r => r.url.includes('/api/me')).flush(MOCK_USER);
    await promise;

    expect(store.hasPermission('RESPONSE_LEAVE')).toBe(true);
    expect(store.hasPermission('SETTLE_LEAVES')).toBe(true);
  });

  it('hasPermission — returns false for absent permission', async () => {
    const promise = store.loadCurrentUser();
    http.expectOne(r => r.url.includes('/api/me')).flush(MOCK_USER);
    await promise;

    expect(store.hasPermission('CREATE_PAYS')).toBe(false);
    expect(store.hasPermission('NONEXISTENT')).toBe(false);
  });

  it('hasPermission — returns false when no user is loaded', () => {
    expect(store.hasPermission('GET_LEAVES')).toBe(false);
  });

  // ── clearUser ─────────────────────────────────────────────────────────────

  it('clearUser — resets all derived signals', async () => {
    const promise = store.loadCurrentUser();
    http.expectOne(r => r.url.includes('/api/me')).flush(MOCK_USER);
    await promise;

    store.clearUser();

    expect(store.currentUser()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.permissions()).toEqual([]);
    expect(store.isHrManager()).toBe(false);
    expect(store.isAdmin()).toBe(false);
  });
});
