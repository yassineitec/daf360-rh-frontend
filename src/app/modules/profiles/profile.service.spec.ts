import { TestBed }                from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient }      from '@angular/common/http';

import { ProfileService }         from './profile.service';
import { environment }            from '../../../environments/environment';
import {
  EmployeeProfile, EmployeeDocument, WorkingTimeRegime, PageResponse, ProfileSummary,
} from './models/profile.model';

const BASE = `${environment.hrApiUrl}/api/hr`;

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MOCK_PROFILE: EmployeeProfile = {
  id: 1, userId: 42, paysId: 179, lifecycleStatus: 'ACTIVE',
  hireDate: '2024-01-15', contractType: 'CDI', contractEndDate: null,
  probationEndDate: null, isOnProbation: false,
  dateOfBirth: '1990-05-10', gender: 'MALE', nationality: 'Tunisienne',
  nationalId: null, passportNumber: null, photoUrl: null,
  personalEmail: 'alice@example.com', phone: '+21611111111', personalAddress: null,
  emergencyContactName: null, emergencyContactRelation: null, emergencyContactPhone: null,
  department: 'ENGINEER', grade: 'SENIOR', discipline: null, nogLevel: null,
  regimeTemplateId: null, regimeStartDate: null, regimeEndDate: null, regimeReason: null,
  bankName: null, iban: null, bankAccountNumber: null, rib: null,
  socialSecurityNumber: null, taxId: null,
  createdAt: '2024-01-15T00:00:00Z', updatedAt: null,
};

const MOCK_PAGE: PageResponse<ProfileSummary> = {
  content:       [{ id: 1, userId: 42, paysId: 179, lifecycleStatus: 'ACTIVE', department: 'ENGINEER', grade: 'SENIOR', contractType: 'CDI', hireDate: '2024-01-15', photoUrl: null }],
  page:          0, size: 20, totalElements: 1, totalPages: 1, last: true,
};

const MOCK_DOC: EmployeeDocument = {
  id: 10, employeeProfileId: 1, documentType: 'CONTRACT',
  fileName: 'contract.pdf', fileUrl: '/files/contract.pdf',
  fileSizeKb: 120, verificationStatus: 'PENDING', uploadedAt: '2024-01-15T00:00:00Z',
};

const MOCK_REGIME: WorkingTimeRegime = {
  id: 5, paysId: 179, code: 'STANDARD_TN', labelFr: 'Standard 40h',
  labelEn: 'Standard 40h', hoursPerWeek: 40, daysPerWeek: 5,
  isFlexible: false, isDefault: true, isActive: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
describe('ProfileService', () => {
  let service: ProfileService;
  let http:    HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProfileService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfileService);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ── list ─────────────────────────────────────────────────────────────────────

  it('list() — GET /api/hr/profiles with no filter', () => {
    service.list().subscribe(res => expect(res).toEqual(MOCK_PAGE));
    const req = http.expectOne(r => r.url === `${BASE}/profiles`);
    expect(req.request.method).toBe('GET');
    req.flush(MOCK_PAGE);
  });

  it('list() — appends query params from filter', () => {
    service.list({ status: 'ACTIVE', search: 'Alice', page: 0, size: 20 }).subscribe();
    const req = http.expectOne(r =>
      r.url === `${BASE}/profiles` &&
      r.params.get('status') === 'ACTIVE' &&
      r.params.get('search') === 'Alice'
    );
    expect(req.request.method).toBe('GET');
    req.flush(MOCK_PAGE);
  });

  it('list() — omits undefined filter fields', () => {
    service.list({ search: undefined, status: undefined }).subscribe();
    const req = http.expectOne(`${BASE}/profiles`);
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    req.flush(MOCK_PAGE);
  });

  // ── getById ──────────────────────────────────────────────────────────────────

  it('getById() — GET /api/hr/profiles/1', () => {
    service.getById(1).subscribe(p => expect(p.id).toBe(1));
    const req = http.expectOne(`${BASE}/profiles/1`);
    expect(req.request.method).toBe('GET');
    req.flush(MOCK_PROFILE);
  });

  // ── create ───────────────────────────────────────────────────────────────────

  it('create() — POST /api/hr/profiles with body', () => {
    const dto = { userId: 42, paysId: 179, employeeId: 'ARX-26-0001', hireDate: '2024-01-15', contractType: 'CDI', department: 'ENGINEER' };
    service.create(dto).subscribe(p => expect(p.id).toBe(1));
    const req = http.expectOne(`${BASE}/profiles`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(MOCK_PROFILE);
  });

  // ── update ───────────────────────────────────────────────────────────────────

  it('update() — PATCH /api/hr/profiles/1', () => {
    const dto = { grade: 'LEAD', reason: 'Promotion' };
    service.update(1, dto).subscribe(p => expect(p.grade).toBe('SENIOR'));
    const req = http.expectOne(`${BASE}/profiles/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(dto);
    req.flush(MOCK_PROFILE);
  });

  // ── transition ───────────────────────────────────────────────────────────────

  it('transition() — POST /api/hr/profiles/1/lifecycle', () => {
    const dto = { newStatus: 'ON_LEAVE' as const, reason: 'Congé médical' };
    service.transition(1, dto).subscribe(p => expect(p.lifecycleStatus).toBe('ACTIVE'));
    const req = http.expectOne(`${BASE}/profiles/1/lifecycle`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(MOCK_PROFILE);
  });

  // ── archive ──────────────────────────────────────────────────────────────────

  it('archive() — DELETE /api/hr/profiles/1', () => {
    let called = false;
    service.archive(1).subscribe(() => (called = true));
    const req = http.expectOne(`${BASE}/profiles/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(called).toBe(true);
  });

  // ── listDocuments ────────────────────────────────────────────────────────────

  it('listDocuments() — GET /api/hr/profiles/1/documents', () => {
    service.listDocuments(1).subscribe(docs => expect(docs.length).toBe(1));
    const req = http.expectOne(`${BASE}/profiles/1/documents`);
    expect(req.request.method).toBe('GET');
    req.flush([MOCK_DOC]);
  });

  // ── uploadDocument ───────────────────────────────────────────────────────────

  it('uploadDocument() — POST multipart/form-data', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    service.uploadDocument(1, file, 'CONTRACT').subscribe(doc => expect(doc.id).toBe(10));
    const req = http.expectOne(`${BASE}/profiles/1/documents`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush(MOCK_DOC);
  });

  // ── listRegimes ──────────────────────────────────────────────────────────────

  it('listRegimes() — GET /api/hr/regimes?paysId=179', () => {
    service.listRegimes(179).subscribe(r => expect(r[0].code).toBe('STANDARD_TN'));
    const req = http.expectOne(r =>
      r.url === `${BASE}/regimes` && r.params.get('paysId') === '179'
    );
    expect(req.request.method).toBe('GET');
    req.flush([MOCK_REGIME]);
  });

  // ── assignRegime ─────────────────────────────────────────────────────────────

  it('assignRegime() — POST /api/hr/profiles/1/regime', () => {
    const dto = { regimeId: 5, startDate: '2026-01-01', reason: 'Nouveau poste' };
    let called = false;
    service.assignRegime(1, dto).subscribe(() => (called = true));
    const req = http.expectOne(`${BASE}/profiles/1/regime`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(called).toBe(true);
  });
});
