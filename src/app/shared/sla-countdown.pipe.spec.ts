import { SlaCountdownPipe, SlaResult } from './sla-countdown.pipe';

function fakeIso(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString();
}

describe('SlaCountdownPipe', () => {
  let pipe: SlaCountdownPipe;
  beforeEach(() => { pipe = new SlaCountdownPipe(); });

  // ── null / undefined ─────────────────────────────────────────────────────
  it('returns none level for null input', () => {
    const r: SlaResult = pipe.transform(null);
    expect(r.level).toBe('none');
    expect(r.label).toBe('—');
    expect(r.hours).toBeNull();
  });

  it('returns none level for undefined input', () => {
    expect(pipe.transform(undefined).level).toBe('none');
  });

  // ── ok (> 72h remaining) ─────────────────────────────────────────────────
  it('returns ok level when 120h (5 days) remain', () => {
    const r = pipe.transform(fakeIso(120));
    expect(r.level).toBe('ok');
    expect(r.hours).toBeGreaterThan(72);
  });

  it('ok label includes days', () => {
    const r = pipe.transform(fakeIso(100));
    expect(r.label).toMatch(/\dj/);
  });

  // ── warning (0–72h remaining) ────────────────────────────────────────────
  it('returns warning level when 2h remain', () => {
    const r = pipe.transform(fakeIso(2));
    expect(r.level).toBe('warning');
    expect(r.hours).toBeGreaterThanOrEqual(0);
    expect(r.hours).toBeLessThanOrEqual(72);
  });

  it('returns warning level at exactly 72h', () => {
    expect(pipe.transform(fakeIso(72)).level).toBe('warning');
  });

  it('warning with 50h uses days format', () => {
    const r = pipe.transform(fakeIso(50));
    expect(r.level).toBe('warning');
    expect(r.label).toMatch(/\dj/);
  });

  // ── critical (overdue) ───────────────────────────────────────────────────
  it('returns critical level when overdue by 3h', () => {
    const r = pipe.transform(fakeIso(-3));
    expect(r.level).toBe('critical');
    expect(r.hours).toBeLessThan(0);
    expect(r.label.startsWith('-')).toBe(true);
  });

  it('returns critical level when overdue by 2 days', () => {
    expect(pipe.transform(fakeIso(-50)).level).toBe('critical');
  });

  it('critical label includes days when overdue > 24h', () => {
    const r = pipe.transform(fakeIso(-30));
    expect(r.label).toMatch(/-\dj/);
  });

  // ── boundary ─────────────────────────────────────────────────────────────
  it('just-future date (0.1h) → warning not critical', () => {
    expect(pipe.transform(fakeIso(0.1)).level).toBe('warning');
  });

  it('past due by 1h (rounds clearly to -1) → critical', () => {
    // 0.1h rounds to 0 (boundary warning); use 1h which is unambiguously negative
    expect(pipe.transform(fakeIso(-1)).level).toBe('critical');
  });
});
