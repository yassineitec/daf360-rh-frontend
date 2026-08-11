# Offboarding Analysis — DAF360 HR App

> Analysis date: 2026-07-02

---

## Executive Summary

Offboarding is implemented across **two parallel systems**:

1. **Profile Lifecycle** — high-level employee states (ACTIVE → OFFBOARDING → TERMINATED → ARCHIVED)
2. **Contract Lifecycle Engine** — low-level per-contract state machines with terminal state locking

The **backend is production-ready**. The **frontend is partially built** — models and services are complete but the dashboard UI and offboarding workflow are still missing.

---

## Backend (`daf360-rh-service`)

### Profile Lifecycle State Machine

File: `src/main/java/com/daf360/rh/domain/enums/LifecycleStatus.java`

```
PRE_ONBOARDING → ACTIVE
                 ACTIVE → ON_LEAVE | ON_MISSION | OFFBOARDING
                 ON_LEAVE  → ACTIVE
                 ON_MISSION → ACTIVE
                 OFFBOARDING → TERMINATED
                 TERMINATED  → ARCHIVED
                 ARCHIVED    (terminal — no further transitions)
```

### Profile Lifecycle Service

File: `src/main/java/com/daf360/rh/service/EmployeeProfileService.java`

| Method | Purpose |
|--------|---------|
| `transitionLifecycle(id, dto, auth)` | Validates transition, fires PII erasure on ARCHIVED, audit logs |
| `archiveProfile(id, auth)` | Shortcut → delegates to `transitionLifecycle()` with `newStatus=ARCHIVED` |
| `pseudonymise(profile)` | Clears: personal email, phone, address, DOB, gender, national ID, passport, bank details, SSN, tax ID, emergency contacts — renames user to `ARCHIVED_{id}` |

Every transition is logged: actor, before/after status, reason.

---

### Contract Lifecycle Engine

File: `src/main/java/com/daf360/rh/lifecycle/EmployeeLifecycleService.java`

Terminal states per contract type:

| Code | Meaning |
|------|---------|
| `FIN_CONTRAT` | Contract end (CDD) |
| `FIN_STAGE` | Internship end |
| `FIN_MISSION` | Freelance mission end |
| `RESILIATION` | Termination / breach |
| `RETRAITE` | Retirement |
| `RUPTURE_PE` | Trial period rejection |
| `INACTIF` | Final archived state |

On terminal state:
- `is_active = false`
- `date_fin_reelle = today`
- `dossier_locked = true` → prevents all further transitions

Fires async notifications (in-app + email) to RH / IT / DIRECTEUR_PAYS on every transition.

---

### Pre-departure Alert Job

File: `src/main/java/com/daf360/rh/lifecycle/LifecycleAlertJob.java`

- Runs daily at **08:00** via `@Scheduled(cron = "0 0 8 * * ?")`
- Finds contracts expiring within 30 days
- Sends to users with: `RH_VIEW_CONTRACTS`, `RH_MANAGE_LIFECYCLE`, `RH_APPROVE_RECRUITMENT_DEMAND`
- Delivers via in-app notification + email simultaneously

---

### Database Schema

Migration: `src/main/resources/db/seed/V33__employee_lifecycle_engine.sql`

| Table | Purpose |
|-------|---------|
| `employee_contracts` | Core contract tracking — flags: `is_active`, `is_archived`, `dossier_locked`; fields: `date_fin_reelle`, `end_reason_code`, `end_notes` |
| `employee_lifecycle_transitions` | Append-only audit log — `statut_avant`, `statut_apres`, `action_code`, `triggered_by`, `commentaire` |
| `employee_lifecycle_alerts` | Pre-departure alert queue — `alert_date`, `target_date`, `recipients` (JSON), `is_sent`, `is_acknowledged` |
| `contract_type_config` | Per-country config per contract type — indemnity rates, alert timing |

---

### REST API

Controller: `src/main/java/com/daf360/rh/controller/EmployeeLifecycleController.java`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/hr/contracts/{id}/transition` | Transition contract state |
| `GET` | `/api/hr/contracts/{id}` | Get contract details |
| `GET` | `/api/hr/contracts/{id}/history` | Transition audit trail |
| `GET` | `/api/hr/lifecycle/alerts` | List pre-departure alerts |
| `POST` | `/api/hr/lifecycle/alerts/{id}/acknowledge` | Acknowledge an alert |
| `DELETE` | `/api/hr/profiles/{id}` | Soft-archive + pseudonymise PII |

---

### Permissions

File: `src/main/java/com/daf360/rh/common/PermissionCatalog.java` — group: **Cycle de vie**

| Code | Purpose |
|------|---------|
| `HR_ARCHIVE_PROFILE` | Archive an employee profile |
| `RH_MANAGE_LIFECYCLE` | Execute contract lifecycle transitions |
| `RH_VIEW_CONTRACTS` | View contracts and lifecycle history |
| `RH_VALIDATE_TRIAL_PERIOD` | Validate/reject trial periods |
| `RH_MANAGE_ALERTS` | Manage lifecycle alerts |

---

## Frontend (`daf360-rh-frontend`)

### Models

| File | Status | Content |
|------|--------|---------|
| `src/app/modules/profiles/models/profile.model.ts` | Done | `LifecycleStatus` type, `LIFECYCLE_TRANSITIONS` map, `LIFECYCLE_LABELS` |
| `src/app/modules/profiles/lifecycle/contract-lifecycle.model.ts` | Done | `ContractDetailDto`, `TransitionRequest`, `LifecycleAlertDto`, `STATUS_CONFIG` |

### Services

| File | Status | Key Methods |
|------|--------|-------------|
| `src/app/modules/profiles/profile.service.ts` | Done | `archive(id)`, `transition(id, dto)` |
| `src/app/modules/profiles/lifecycle/contract-lifecycle.service.ts` | Done | `transition()`, `getAlerts()`, `acknowledgeAlert()` |

### UI Components

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Profile header badge | `profile-header/profile-header.component.ts` | Done | Orange=OFFBOARDING, Red=TERMINATED, Gray=ARCHIVED |
| Profile grid card | `components/profile-grid-card/profile-grid-card.component.ts` | Done | Color-coded status in card view |
| Status badge utils | `src/app/shared/status-badge.utils.ts` | Done | Shared across all components |
| Profile detail — transition logic | `profile-detail.component.ts` | Partial | Signals + `confirmTransition()` present; modal template not fully visible |
| `/hr/lifecycle` dashboard | `src/app/modules/lifecycle/lifecycle.component.ts` | **Stub** | Renders placeholder text: *"implémentation à venir"* |
| Alert list / acknowledge UI | — | **Missing** | Backend ready; no frontend screen exists |
| "Start offboarding" button/workflow | — | **Missing** | Infrastructure exists; no visible entry point in profile detail |

---

## End-to-End Offboarding Workflow

```
1. HR Manager opens employee profile (status: ACTIVE)
2. Initiates offboarding → ACTIVE → OFFBOARDING
3. Each active contract transitions to terminal state
   (FIN_CONTRAT / RESILIATION / RETRAITE / ...)
   → dossier_locked = true (no further contract changes)
4. Profile transitions OFFBOARDING → TERMINATED
5. Profile transitions TERMINATED → ARCHIVED
   → pseudonymise() wipes all PII
6. (Background) LifecycleAlertJob fires 30 days before contract expiry
   → in-app + email to RH / IT / DIRECTEUR_PAYS
```

---

## Gap Analysis

### Backend — Production-ready

- Profile state machine with PII erasure
- Contract lifecycle engine with dossier locking
- Pre-departure CRON alerts
- Append-only audit trail
- Full REST API (14 endpoints)
- DB schema (4 tables)
- Permissions in catalog

### Frontend — Gaps

| Gap | Impact | Effort |
|-----|--------|--------|
| `/hr/lifecycle` dashboard page | High — no way to see/manage lifecycle alerts | Medium |
| "Start offboarding" entry point on profile detail | High — no UI to trigger ACTIVE → OFFBOARDING | Low–Medium |
| Alert acknowledge UI | Medium — alerts fire but can't be dismissed in UI | Low |
| Contract transition modal | Medium — can't drive contract to terminal state from UI | Medium |

---

*Generated from codebase analysis — `daf360-rh-service` + `daf360-rh-frontend`*
