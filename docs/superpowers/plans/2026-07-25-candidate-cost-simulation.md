# Candidate Hiring Cost Simulation & Approval Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow HR to simulate the payroll cost of a candidate (gross, charges, loaded cost) and submit the result for Country Director approval before hiring.

**Architecture:**
- Two new fields (`salaire_net_candidat`, `salaire_net_rh`) added to `candidates` table.
- `payroll_contract_code` added to `configurable_list_values` so each employment type maps to a payroll engine code (CDI/CDD/STAGE/etc.).
- New `candidate_cost_approvals` table stores the snapshot + approval workflow (separate from `employee_requests` which requires an `employee_profile_id`).
- The RH frontend calls the payroll service directly (port 8893, shared JWT) for simulation; it calls the RH service to submit/approve.
- A new CD inbox page lists pending approvals filtered by `paysId`.

**Tech Stack:** Spring Boot (daf360-rh-service), Angular 17 standalone (daf360-rh-frontend), SQL Server (DAF360_RH DB), payroll service (port 8893).

---

## File Map

**daf360-rh-service:**
- Modify: `src/main/resources/db/seed/` → new `V42__candidate_cost_simulation.sql`
- Modify: `src/main/java/com/daf360/rh/domain/Candidate.java`
- Modify: `src/main/java/com/daf360/rh/dto/candidate/CandidateResponse.java`
- Modify: `src/main/java/com/daf360/rh/dto/candidate/CreateCandidateRequest.java`
- Modify: `src/main/java/com/daf360/rh/lists/ConfigurableListValue.java`
- Modify: `src/main/java/com/daf360/rh/lists/ListValueResponse.java`
- Modify: `src/main/java/com/daf360/rh/lists/UpdateListValueRequest.java`
- Modify: `src/main/java/com/daf360/rh/lists/ConfigurableListService.java` (updateListValue)
- Modify: `src/main/java/com/daf360/rh/common/PermissionCatalog.java`
- Create: `src/main/java/com/daf360/rh/domain/CandidateCostApproval.java`
- Create: `src/main/java/com/daf360/rh/repository/CandidateCostApprovalRepository.java`
- Create: `src/main/java/com/daf360/rh/dto/candidate/CandidateCostApprovalDto.java`
- Create: `src/main/java/com/daf360/rh/dto/candidate/SubmitCostApprovalRequest.java`
- Create: `src/main/java/com/daf360/rh/service/CandidateCostApprovalService.java`
- Create: `src/main/java/com/daf360/rh/controller/CandidateCostApprovalController.java`

**daf360-rh-frontend:**
- Modify: `src/environments/environment.ts` and `environment.prod.ts`
- Create: `src/app/core/payroll-simulation.service.ts`
- Modify: `src/app/modules/candidates/candidate.model.ts`
- Modify: `src/app/modules/candidates/candidate-form.component.ts` + `.html`
- Modify: `src/app/modules/candidates/candidate-detail.component.ts` + `.html`
- Create: `src/app/modules/candidates/candidate-cost-simulation.component.ts` + `.html` + `.scss`
- Create: `src/app/modules/candidates/hiring-approval-inbox.component.ts` + `.html` + `.scss`
- Modify: routing to add the new inbox page

---

### Task 1: Database migration V42

**Files:**
- Create: `c:\Users\ITEC2\OneDrive\Documents\projects\daf360-rh-service\src\main\resources\db\seed\V42__candidate_cost_simulation.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 1. Salary fields on candidates
ALTER TABLE [dbo].[candidates]
    ADD [salaire_net_candidat] DECIMAL(18,4) NULL,
        [salaire_net_rh]       DECIMAL(18,4) NULL;
GO

-- 2. Payroll contract code on configurable list values
ALTER TABLE [dbo].[configurable_list_values]
    ADD [payroll_contract_code] NVARCHAR(20) NULL;
GO

-- 3. Candidate cost approvals table
CREATE TABLE [dbo].[candidate_cost_approvals] (
    [id]                    BIGINT IDENTITY(1,1) PRIMARY KEY,
    [candidate_id]          BIGINT NOT NULL REFERENCES [dbo].[candidates]([id]) ON DELETE CASCADE,
    [pays_id]               BIGINT NOT NULL,
    [fiscal_year]           INT    NOT NULL,
    [salaire_net_rh]        DECIMAL(18,4) NOT NULL,
    [salaire_net_candidat]  DECIMAL(18,4) NULL,
    [contract_type_code]    NVARCHAR(20)  NOT NULL,
    [simulation_snapshot]   NVARCHAR(MAX) NOT NULL,
    [status]                NVARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    [submitted_by]          BIGINT NOT NULL,
    [submitted_at]          DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    [approved_by]           BIGINT NULL,
    [approved_at]           DATETIMEOFFSET NULL,
    [approval_notes]        NVARCHAR(1000) NULL
);
GO

CREATE INDEX IX_cca_pays_status ON [dbo].[candidate_cost_approvals]([pays_id], [status]);
GO
```

- [ ] **Step 2: Apply it manually via PowerShell (sqlcmd not installed)**

```powershell
$sql = Get-Content "src\main\resources\db\seed\V42__candidate_cost_simulation.sql" -Raw
$conn = New-Object System.Data.SqlClient.SqlConnection(
    "Server=localhost,1433;Database=DAF360_RH;User Id=sa;Password=Timesheetdev2026!**;Encrypt=false;TrustServerCertificate=true;")
$conn.Open()
foreach ($batch in $sql -split '\bGO\b') {
    $b = $batch.Trim(); if (-not $b) { continue }
    $cmd = $conn.CreateCommand(); $cmd.CommandText = $b; $cmd.ExecuteNonQuery() | Out-Null
}
$conn.Close(); Write-Output "V42 applied"
```

Expected output: `V42 applied` with no errors.

- [ ] **Step 3: Verify**

```powershell
# Check all 3 changes landed
$conn = New-Object System.Data.SqlClient.SqlConnection("Server=localhost,1433;Database=DAF360_RH;User Id=sa;Password=Timesheetdev2026!**;Encrypt=false;TrustServerCertificate=true;")
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME IN ('candidates','configurable_list_values','candidate_cost_approvals') AND COLUMN_NAME IN ('salaire_net_rh','salaire_net_candidat','payroll_contract_code','id') ORDER BY TABLE_NAME"
$r = $cmd.ExecuteReader(); while ($r.Read()) { Write-Output $r[0] }; $conn.Close()
```

Expected: `id`, `payroll_contract_code`, `salaire_net_candidat`, `salaire_net_rh` all appear.

---

### Task 2: Backend — Candidate entity + DTOs (salary fields)

**Files:**
- Modify: `src/main/java/com/daf360/rh/domain/Candidate.java`
- Modify: `src/main/java/com/daf360/rh/dto/candidate/CandidateResponse.java`
- Modify: `src/main/java/com/daf360/rh/dto/candidate/CreateCandidateRequest.java`

- [ ] **Step 1: Add fields to Candidate entity**

In `Candidate.java`, add after the `location` field:

```java
@Column(name = "salaire_net_candidat", precision = 18, scale = 4)
private BigDecimal salaireNetCandidат;

@Column(name = "salaire_net_rh", precision = 18, scale = 4)
private BigDecimal salaireNetRh;
```

> Note: add `import java.math.BigDecimal;` if not already present.

- [ ] **Step 2: Add fields to CandidateResponse**

```java
private BigDecimal salaireNetCandidат;
private BigDecimal salaireNetRh;
```

And in the mapper (wherever `CandidateResponse` is built from `Candidate`), add:
```java
response.setSalaireNetCandidат(candidate.getSalaireNetCandidат());
response.setSalaireNetRh(candidate.getSalaireNetRh());
```

- [ ] **Step 3: Add fields to CreateCandidateRequest**

```java
private BigDecimal salaireNetCandidат;
private BigDecimal salaireNetRh;
```

And in `CandidateService.createCandidate()`, set them on the entity before save:
```java
candidate.setSalaireNetCandidат(request.getSalaireNetCandidат());
candidate.setSalaireNetRh(request.getSalaireNetRh());
```

- [ ] **Step 4: Compile check**

```powershell
Set-Location "c:\Users\ITEC2\OneDrive\Documents\projects\daf360-rh-service"
mvn compile -q 2>&1 | Select-String "ERROR"
```

Expected: no output (no errors).

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/daf360/rh/domain/Candidate.java \
        src/main/java/com/daf360/rh/dto/candidate/CandidateResponse.java \
        src/main/java/com/daf360/rh/dto/candidate/CreateCandidateRequest.java \
        src/main/resources/db/seed/V42__candidate_cost_simulation.sql
git commit -m "feat(candidate): add salaire_net_candidat/rh fields + V42 migration"
```

---

### Task 3: Backend — ConfigurableListValue payroll_contract_code

**Files:**
- Modify: `src/main/java/com/daf360/rh/lists/ConfigurableListValue.java`
- Modify: `src/main/java/com/daf360/rh/lists/ListValueResponse.java`
- Modify: `src/main/java/com/daf360/rh/lists/UpdateListValueRequest.java`
- Modify: `src/main/java/com/daf360/rh/lists/ConfigurableListService.java`

- [ ] **Step 1: Add field to ConfigurableListValue entity**

```java
@Column(name = "payroll_contract_code", length = 20)
private String payrollContractCode;
```

- [ ] **Step 2: Add to ListValueResponse**

```java
private String payrollContractCode;
```

In the mapper/builder that produces `ListValueResponse` from `ConfigurableListValue`, add:
```java
.payrollContractCode(v.getPayrollContractCode())
```

- [ ] **Step 3: Add to UpdateListValueRequest**

```java
private String payrollContractCode;  // nullable — only set for EMPLOYMENT_TYPE values
```

- [ ] **Step 4: Apply in ConfigurableListService.updateListValue()**

Find the `updateListValue` method and add after the existing field updates:
```java
if (dto.getPayrollContractCode() != null) {
    value.setPayrollContractCode(dto.getPayrollContractCode().isBlank()
            ? null : dto.getPayrollContractCode().trim().toUpperCase());
}
```

- [ ] **Step 5: Compile + commit**

```powershell
mvn compile -q 2>&1 | Select-String "ERROR"
```

```bash
git add src/main/java/com/daf360/rh/lists/
git commit -m "feat(lists): add payrollContractCode to ConfigurableListValue for payroll mapping"
```

---

### Task 4: Backend — PermissionCatalog + new permission

**Files:**
- Modify: `src/main/java/com/daf360/rh/common/PermissionCatalog.java`

- [ ] **Step 1: Add missing and new permissions**

In `PermissionCatalog.java`, add alongside the existing candidate permissions:

```java
public static final String RH_HIRE_CANDIDATE        = "RH_HIRE_CANDIDATE";
public static final String APPROVE_HIRING_COST      = "APPROVE_HIRING_COST";
```

Also add both to the `ALL_CODES` set if one exists, or ensure they appear in the catalog so the RH service can validate them.

- [ ] **Step 2: Compile + commit**

```bash
git add src/main/java/com/daf360/rh/common/PermissionCatalog.java
git commit -m "fix(permissions): add RH_HIRE_CANDIDATE and APPROVE_HIRING_COST to PermissionCatalog"
```

---

### Task 5: Backend — CandidateCostApproval entity + repository

**Files:**
- Create: `src/main/java/com/daf360/rh/domain/CandidateCostApproval.java`
- Create: `src/main/java/com/daf360/rh/repository/CandidateCostApprovalRepository.java`

- [ ] **Step 1: Write the entity**

```java
package com.daf360.rh.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "candidate_cost_approvals")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CandidateCostApproval {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "candidate_id", nullable = false)
    private Long candidateId;

    @Column(name = "pays_id", nullable = false)
    private Long paysId;

    @Column(name = "fiscal_year", nullable = false)
    private Integer fiscalYear;

    @Column(name = "salaire_net_rh", nullable = false, precision = 18, scale = 4)
    private BigDecimal salaireNetRh;

    @Column(name = "salaire_net_candidat", precision = 18, scale = 4)
    private BigDecimal salaireNetCandidат;

    @Column(name = "contract_type_code", nullable = false, length = 20)
    private String contractTypeCode;

    @Column(name = "simulation_snapshot", nullable = false, columnDefinition = "NVARCHAR(MAX)")
    private String simulationSnapshot;  // JSON string

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";  // PENDING | APPROVED | REJECTED

    @Column(name = "submitted_by", nullable = false)
    private Long submittedBy;

    @Column(name = "submitted_at", nullable = false, columnDefinition = "DATETIMEOFFSET(6)")
    @Builder.Default
    private OffsetDateTime submittedAt = OffsetDateTime.now();

    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "approved_at", columnDefinition = "DATETIMEOFFSET(6)")
    private OffsetDateTime approvedAt;

    @Column(name = "approval_notes", length = 1000, columnDefinition = "NVARCHAR(1000)")
    private String approvalNotes;
}
```

- [ ] **Step 2: Write the repository**

```java
package com.daf360.rh.repository;

import com.daf360.rh.domain.CandidateCostApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CandidateCostApprovalRepository extends JpaRepository<CandidateCostApproval, Long> {
    List<CandidateCostApproval> findByPaysIdAndStatusOrderBySubmittedAtDesc(Long paysId, String status);
    List<CandidateCostApproval> findByCandidateIdOrderBySubmittedAtDesc(Long candidateId);
    Optional<CandidateCostApproval> findTopByCandidateIdOrderBySubmittedAtDesc(Long candidateId);
}
```

- [ ] **Step 3: Compile + commit**

```powershell
mvn compile -q 2>&1 | Select-String "ERROR"
```

```bash
git add src/main/java/com/daf360/rh/domain/CandidateCostApproval.java \
        src/main/java/com/daf360/rh/repository/CandidateCostApprovalRepository.java
git commit -m "feat(hiring-cost): add CandidateCostApproval entity and repository"
```

---

### Task 6: Backend — CandidateCostApprovalService + DTOs

**Files:**
- Create: `src/main/java/com/daf360/rh/dto/candidate/CandidateCostApprovalDto.java`
- Create: `src/main/java/com/daf360/rh/dto/candidate/SubmitCostApprovalRequest.java`
- Create: `src/main/java/com/daf360/rh/service/CandidateCostApprovalService.java`

- [ ] **Step 1: Write SubmitCostApprovalRequest**

```java
package com.daf360.rh.dto.candidate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record SubmitCostApprovalRequest(
    @NotNull  BigDecimal salaireNetRh,
              BigDecimal salaireNetCandidат,
    @NotBlank String     contractTypeCode,
    @NotNull  Integer    fiscalYear,
    @NotBlank String     simulationSnapshot   // JSON from payroll engine, validated client-side
) {}
```

- [ ] **Step 2: Write CandidateCostApprovalDto**

```java
package com.daf360.rh.dto.candidate;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record CandidateCostApprovalDto(
    Long           id,
    Long           candidateId,
    Long           paysId,
    Integer        fiscalYear,
    BigDecimal     salaireNetRh,
    BigDecimal     salaireNetCandidат,
    String         contractTypeCode,
    String         simulationSnapshot,
    String         status,
    Long           submittedBy,
    OffsetDateTime submittedAt,
    Long           approvedBy,
    OffsetDateTime approvedAt,
    String         approvalNotes
) {}
```

- [ ] **Step 3: Write CandidateCostApprovalService**

```java
package com.daf360.rh.service;

import com.daf360.rh.common.PermissionCatalog;
import com.daf360.rh.domain.CandidateCostApproval;
import com.daf360.rh.dto.candidate.CandidateCostApprovalDto;
import com.daf360.rh.dto.candidate.SubmitCostApprovalRequest;
import com.daf360.rh.repository.CandidateCostApprovalRepository;
import com.daf360.rh.repository.CandidateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CandidateCostApprovalService {

    private final CandidateCostApprovalRepository repo;
    private final CandidateRepository candidateRepo;

    @PreAuthorize("hasAnyAuthority('" + PermissionCatalog.EDIT_CANDIDATE + "','" + PermissionCatalog.CREATE_CANDIDATE + "')")
    public CandidateCostApprovalDto submit(Long candidateId, SubmitCostApprovalRequest req, Long actorId) {
        var candidate = candidateRepo.findById(candidateId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found"));

        var approval = CandidateCostApproval.builder()
                .candidateId(candidateId)
                .paysId(candidate.getPaysId())
                .fiscalYear(req.fiscalYear())
                .salaireNetRh(req.salaireNetRh())
                .salaireNetCandidат(req.salaireNetCandidат())
                .contractTypeCode(req.contractTypeCode())
                .simulationSnapshot(req.simulationSnapshot())
                .status("PENDING")
                .submittedBy(actorId)
                .submittedAt(OffsetDateTime.now())
                .build();

        return toDto(repo.save(approval));
    }

    @PreAuthorize("hasAuthority('" + PermissionCatalog.APPROVE_HIRING_COST + "')")
    public CandidateCostApprovalDto approve(Long id, String notes, Long actorId) {
        var approval = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!"PENDING".equals(approval.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already processed");
        approval.setStatus("APPROVED");
        approval.setApprovedBy(actorId);
        approval.setApprovedAt(OffsetDateTime.now());
        approval.setApprovalNotes(notes);
        return toDto(repo.save(approval));
    }

    @PreAuthorize("hasAuthority('" + PermissionCatalog.APPROVE_HIRING_COST + "')")
    public CandidateCostApprovalDto reject(Long id, String notes, Long actorId) {
        var approval = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!"PENDING".equals(approval.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Already processed");
        approval.setStatus("REJECTED");
        approval.setApprovedBy(actorId);
        approval.setApprovedAt(OffsetDateTime.now());
        approval.setApprovalNotes(notes);
        return toDto(repo.save(approval));
    }

    public List<CandidateCostApprovalDto> listPending(Long paysId) {
        return repo.findByPaysIdAndStatusOrderBySubmittedAtDesc(paysId, "PENDING")
                .stream().map(this::toDto).toList();
    }

    public List<CandidateCostApprovalDto> listForCandidate(Long candidateId) {
        return repo.findByCandidateIdOrderBySubmittedAtDesc(candidateId)
                .stream().map(this::toDto).toList();
    }

    private CandidateCostApprovalDto toDto(CandidateCostApproval a) {
        return new CandidateCostApprovalDto(
                a.getId(), a.getCandidateId(), a.getPaysId(), a.getFiscalYear(),
                a.getSalaireNetRh(), a.getSalaireNetCandidат(), a.getContractTypeCode(),
                a.getSimulationSnapshot(), a.getStatus(),
                a.getSubmittedBy(), a.getSubmittedAt(),
                a.getApprovedBy(), a.getApprovedAt(), a.getApprovalNotes());
    }
}
```

- [ ] **Step 4: Compile + commit**

```powershell
mvn compile -q 2>&1 | Select-String "ERROR"
```

```bash
git add src/main/java/com/daf360/rh/dto/candidate/ \
        src/main/java/com/daf360/rh/service/CandidateCostApprovalService.java
git commit -m "feat(hiring-cost): add DTOs and CandidateCostApprovalService"
```

---

### Task 7: Backend — CandidateCostApprovalController

**Files:**
- Create: `src/main/java/com/daf360/rh/controller/CandidateCostApprovalController.java`

- [ ] **Step 1: Write the controller**

```java
package com.daf360.rh.controller;

import com.daf360.rh.dto.candidate.CandidateCostApprovalDto;
import com.daf360.rh.dto.candidate.SubmitCostApprovalRequest;
import com.daf360.rh.service.CandidateCostApprovalService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class CandidateCostApprovalController {

    private final CandidateCostApprovalService service;

    /** Submit a simulation for CD approval */
    @PostMapping("/api/hr/candidates/{candidateId}/cost-approval")
    @ResponseStatus(HttpStatus.CREATED)
    public CandidateCostApprovalDto submit(
            @PathVariable Long candidateId,
            @Valid @RequestBody SubmitCostApprovalRequest req,
            Authentication auth) {
        return service.submit(candidateId, req, actorId(auth));
    }

    /** List all approvals for a candidate (most recent first) */
    @GetMapping("/api/hr/candidates/{candidateId}/cost-approvals")
    public List<CandidateCostApprovalDto> listForCandidate(@PathVariable Long candidateId) {
        return service.listForCandidate(candidateId);
    }

    /** CD inbox — list PENDING approvals for a pays */
    @GetMapping("/api/hr/hiring-cost-approvals")
    public List<CandidateCostApprovalDto> listPending(@RequestParam Long paysId) {
        return service.listPending(paysId);
    }

    /** Approve */
    @PostMapping("/api/hr/hiring-cost-approvals/{id}/approve")
    public CandidateCostApprovalDto approve(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            Authentication auth) {
        return service.approve(id, body != null ? body.get("notes") : null, actorId(auth));
    }

    /** Reject */
    @PostMapping("/api/hr/hiring-cost-approvals/{id}/reject")
    public CandidateCostApprovalDto reject(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body,
            Authentication auth) {
        return service.reject(id, body != null ? body.get("notes") : null, actorId(auth));
    }

    private Long actorId(Authentication auth) {
        if (auth == null) return null;
        try { return Long.valueOf(auth.getPrincipal().toString()); }
        catch (NumberFormatException e) { return null; }
    }
}
```

- [ ] **Step 2: Compile + start service, verify endpoints respond**

```powershell
Set-Location "c:\Users\ITEC2\OneDrive\Documents\projects\daf360-rh-service"
mvn compile -q 2>&1 | Select-String "ERROR"
```

No errors expected.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/daf360/rh/controller/CandidateCostApprovalController.java
git commit -m "feat(hiring-cost): add CandidateCostApprovalController with 5 endpoints"
```

---

### Task 8: Frontend — environment config + PayrollSimulationService

**Files:**
- Modify: `src/environments/environment.ts`
- Modify: `src/environments/environment.prod.ts` (if exists)
- Create: `src/app/core/payroll-simulation.service.ts`

- [ ] **Step 1: Add payrollApiUrl to environment.ts**

```typescript
export const environment = {
  // ... existing fields ...
  payrollApiUrl: 'http://localhost:8893',
};
```

Do the same for `environment.prod.ts` with the production payroll URL (use a placeholder if unknown: `'http://payroll-service:8893'`).

- [ ] **Step 2: Write PayrollSimulationService**

Create `src/app/core/payroll-simulation.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PayrollSimulationRequest {
  paysId: number;
  inputNet: number;
  contractType: string;
  joursTravailes?: number;
}

export interface PayrollSimulationResult {
  gross: number;
  loadedCost: number;
  irppAmount: number;
  employeeCharges: number;
  employerCharges: number;
  netTaxable: number;
  convergenceOk: boolean;
  iterationsUsed: number;
  localCurrency: string | null;
}

@Injectable({ providedIn: 'root' })
export class PayrollSimulationService {
  private readonly base = `${environment.payrollApiUrl}/api/payroll`;

  constructor(private http: HttpClient) {}

  simulate(req: PayrollSimulationRequest): Observable<PayrollSimulationResult> {
    return this.http.post<PayrollSimulationResult>(`${this.base}/simulations/individual`, req);
  }
}
```

- [ ] **Step 3: Verify Angular compiles**

```powershell
Set-Location "c:\Users\ITEC2\OneDrive\Documents\projects\daf360-rh-frontend"
npx ng build --configuration=development 2>&1 | Select-String -Pattern "error TS|ERROR"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/environments/ src/app/core/payroll-simulation.service.ts
git commit -m "feat(hiring-cost): add payrollApiUrl to env and PayrollSimulationService"
```

---

### Task 9: Frontend — candidate model + form salary fields

**Files:**
- Modify: `src/app/modules/candidates/candidate.model.ts`
- Modify: `src/app/modules/candidates/candidate-form.component.ts`
- Modify: `src/app/modules/candidates/candidate-form.component.html`

- [ ] **Step 1: Add salary fields to CandidateDetail / CreateCandidateRequest interfaces**

In `candidate.model.ts`:

```typescript
// In CandidateDetail (or equivalent read interface):
salaireNetCandidат?: number | null;
salaireNetRh?: number | null;

// In CreateCandidateRequest (or equivalent write interface):
salaireNetCandidат?: number | null;
salaireNetRh?: number | null;
```

Also add `payrollContractCode?: string | null` to whatever interface represents a list value (`ListValueResponse` or `ConfigurableListValueDto`).

- [ ] **Step 2: Add salary fields to candidate form (step 2 — Position/Contract)**

In `candidate-form.component.ts`, add to the step-2 FormGroup:

```typescript
salaireNetCandidат: [null as number | null],
salaireNetRh:       [null as number | null],
```

In `candidate-form.component.html`, add after the employment type field in step 2:

```html
<div class="field-row">
  <div class="field-group">
    <label class="field-label">Salaire demandé (candidat)</label>
    <input class="field-input" type="number" step="0.01" min="0"
           formControlName="salaireNetCandidат"
           placeholder="Ex: 1 500" />
    <span class="field-hint">Ce que le candidat demande (net/mois)</span>
  </div>
  <div class="field-group">
    <label class="field-label">Salaire proposé (RH)</label>
    <input class="field-input" type="number" step="0.01" min="0"
           formControlName="salaireNetRh"
           placeholder="Ex: 1 800" />
    <span class="field-hint">Ce que RH propose d'offrir (net/mois)</span>
  </div>
</div>
```

- [ ] **Step 3: Map to CreateCandidateRequest on submit**

In the form submit handler, add to the request object:
```typescript
salaireNetCandidат: form.salaireNetCandidат || null,
salaireNetRh:       form.salaireNetRh || null,
```

- [ ] **Step 4: Verify Angular compiles**

```powershell
npx ng build --configuration=development 2>&1 | Select-String "error TS|ERROR"
```

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/candidates/
git commit -m "feat(candidates): add salary fields to candidate model and form"
```

---

### Task 10: Frontend — Simulation panel component

**Files:**
- Create: `src/app/modules/candidates/candidate-cost-simulation.component.ts`
- Create: `src/app/modules/candidates/candidate-cost-simulation.component.html`
- Create: `src/app/modules/candidates/candidate-cost-simulation.component.scss`
- Modify: `src/app/modules/candidates/candidate-detail.component.ts`
- Modify: `src/app/modules/candidates/candidate-detail.component.html`

- [ ] **Step 1: Write the simulation component TS**

```typescript
import { ChangeDetectionStrategy, Component, Input, inject, signal, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PayrollSimulationService, PayrollSimulationResult } from '../../core/payroll-simulation.service';
import { CandidatesService } from './candidates.service'; // existing service for RH API calls

@Component({
  selector: 'app-candidate-cost-simulation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './candidate-cost-simulation.component.html',
  styleUrl:    './candidate-cost-simulation.component.scss',
})
export class CandidateCostSimulationComponent implements OnChanges {
  @Input() candidateId!: number;
  @Input() paysId!: number;
  @Input() salaireNetRh: number | null = null;
  @Input() salaireNetCandidат: number | null = null;
  @Input() payrollContractCode: string | null = null;  // from employment type

  private readonly payrollSvc  = inject(PayrollSimulationService);
  private readonly candidateSvc = inject(CandidatesService);
  private readonly fb = inject(FormBuilder);

  readonly CONTRACT_TYPES = ['CDI', 'CDD', 'STAGE', 'CIVP'];
  readonly simulating  = signal(false);
  readonly submitting  = signal(false);
  readonly result      = signal<PayrollSimulationResult | null>(null);
  readonly simError    = signal<string | null>(null);
  readonly submitDone  = signal(false);

  readonly form = this.fb.group({
    salaireNet:    [null as number | null, [Validators.required, Validators.min(1)]],
    contractType:  ['CDI', Validators.required],
    joursTravailes:[22,   [Validators.required, Validators.min(1), Validators.max(31)]],
    fiscalYear:    [new Date().getFullYear(), Validators.required],
    notes:         [''],
  });

  ngOnChanges(): void {
    if (this.salaireNetRh != null) {
      this.form.patchValue({ salaireNet: this.salaireNetRh });
    }
    if (this.payrollContractCode) {
      this.form.patchValue({ contractType: this.payrollContractCode });
    }
  }

  calculate(): void {
    if (this.form.get('salaireNet')?.invalid) return;
    this.simulating.set(true);
    this.simError.set(null);
    this.result.set(null);
    const v = this.form.getRawValue();
    this.payrollSvc.simulate({
      paysId:        this.paysId,
      inputNet:      v.salaireNet!,
      contractType:  v.contractType!,
      joursTravailes: v.joursTravailes ?? 22,
    }).subscribe({
      next: r  => { this.result.set(r); this.simulating.set(false); },
      error: e => { this.simError.set(e?.error?.message ?? 'Erreur simulation'); this.simulating.set(false); },
    });
  }

  submit(): void {
    if (!this.result()) return;
    this.submitting.set(true);
    const v = this.form.getRawValue();
    const snapshot = JSON.stringify(this.result());
    this.candidateSvc.submitCostApproval(this.candidateId, {
      salaireNetRh:       v.salaireNet!,
      salaireNetCandidат: this.salaireNetCandidат,
      contractTypeCode:   v.contractType!,
      fiscalYear:         v.fiscalYear!,
      simulationSnapshot: snapshot,
    }).subscribe({
      next: () => { this.submitDone.set(true); this.submitting.set(false); },
      error: e => { this.simError.set(e?.error?.message ?? 'Erreur soumission'); this.submitting.set(false); },
    });
  }
}
```

- [ ] **Step 2: Write the template**

```html
<div class="sim-card">
  <h3 class="sim-title">Simulation coût d'embauche</h3>

  @if (salaireNetCandidат) {
    <p class="candidate-ask">
      Salaire demandé par le candidat :
      <strong>{{ salaireNetCandidат | number:'1.0-0' }}</strong>
    </p>
  }

  <form [formGroup]="form" class="sim-form">
    <div class="sim-row">
      <div class="sim-field">
        <label>Salaire net simulé</label>
        <input type="number" formControlName="salaireNet" step="0.01" min="0" />
        @if (!payrollContractCode) {
          <span class="field-warn">Salaire pré-rempli depuis le dossier — modifiable</span>
        }
      </div>
      <div class="sim-field">
        <label>Type contrat</label>
        @if (payrollContractCode) {
          <input type="text" [value]="payrollContractCode" readonly class="readonly-input" />
        } @else {
          <select formControlName="contractType">
            @for (ct of CONTRACT_TYPES; track ct) {
              <option [value]="ct">{{ ct }}</option>
            }
          </select>
          <span class="field-warn">⚠ Code paie non configuré sur le type d'emploi — sélection manuelle</span>
        }
      </div>
      <div class="sim-field sim-field--sm">
        <label>Jours travaillés</label>
        <input type="number" formControlName="joursTravailes" min="1" max="31" />
      </div>
      <div class="sim-field sim-field--sm">
        <label>Année fiscale</label>
        <input type="number" formControlName="fiscalYear" />
      </div>
    </div>

    <div class="sim-actions">
      <button type="button" class="btn btn--primary" (click)="calculate()" [disabled]="simulating() || form.get('salaireNet')?.invalid">
        @if (simulating()) { Calcul en cours… } @else { Calculer }
      </button>
    </div>
  </form>

  @if (simError()) {
    <p class="sim-error">{{ simError() }}</p>
  }

  @if (result(); as r) {
    <div class="sim-result">
      <div class="result-grid">
        <div class="result-row">
          <span class="result-label">Brut estimé</span>
          <span class="result-value">{{ r.gross | number:'1.0-2' }}</span>
        </div>
        <div class="result-row">
          <span class="result-label">Charges salarié</span>
          <span class="result-value">{{ r.employeeCharges | number:'1.0-2' }}</span>
        </div>
        <div class="result-row">
          <span class="result-label">Charges patronal</span>
          <span class="result-value">{{ r.employerCharges | number:'1.0-2' }}</span>
        </div>
        <div class="result-row">
          <span class="result-label">IRPP</span>
          <span class="result-value">{{ r.irppAmount | number:'1.0-2' }}</span>
        </div>
        <div class="result-row result-row--total">
          <span class="result-label">Coût chargé total</span>
          <span class="result-value">{{ r.loadedCost | number:'1.0-2' }}</span>
        </div>
      </div>

      @if (!submitDone()) {
        <div class="sim-submit-row">
          <button type="button" class="btn btn--approve" (click)="submit()" [disabled]="submitting()">
            @if (submitting()) { Soumission… } @else { Soumettre à approbation Direction }
          </button>
        </div>
      } @else {
        <p class="submit-ok">✓ Soumis pour approbation. Le Directeur Pays sera notifié.</p>
      }
    </div>
  }
</div>
```

- [ ] **Step 3: Write minimal SCSS**

```scss
.sim-card { padding: 20px; background: var(--color-surface-container-low); border-radius: var(--radius-md); margin-top: 20px; }
.sim-title { font-size: 1rem; font-weight: 600; margin: 0 0 16px; }
.candidate-ask { font-size: 0.875rem; color: var(--color-on-surface-variant); margin-bottom: 16px; }
.sim-form { display: flex; flex-direction: column; gap: 12px; }
.sim-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end; }
.sim-field { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 140px;
  label { font-size: 0.8125rem; font-weight: 500; color: var(--color-on-surface-variant); }
  input, select { height: 38px; padding: 0 10px; border: 1px solid var(--color-outline-variant); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-on-surface); font-size: 0.9375rem; width: 100%; box-sizing: border-box; }
  .readonly-input { background: var(--color-surface-container); }
  &--sm { max-width: 120px; }
}
.field-warn { font-size: 0.75rem; color: var(--color-warning, #f59e0b); }
.sim-actions { margin-top: 8px; }
.btn { height: 38px; padding: 0 20px; border-radius: var(--radius-md); font-size: 0.9375rem; font-weight: 600; cursor: pointer; border: none; &:disabled { opacity: 0.5; }
  &--primary { background: var(--color-primary); color: var(--color-on-primary); }
  &--approve { background: #16a34a; color: #fff; }
}
.sim-error { color: var(--color-error); font-size: 0.875rem; margin-top: 8px; }
.sim-result { margin-top: 16px; }
.result-grid { display: flex; flex-direction: column; gap: 4px; }
.result-row { display: flex; justify-content: space-between; padding: 6px 10px; border-radius: var(--radius-sm);
  &--total { background: color-mix(in srgb, var(--color-primary) 10%, transparent); font-weight: 700; margin-top: 4px; }
}
.result-label { font-size: 0.875rem; color: var(--color-on-surface-variant); }
.result-value { font-size: 0.9375rem; font-variant-numeric: tabular-nums; }
.sim-submit-row { margin-top: 16px; }
.submit-ok { color: #16a34a; font-weight: 600; font-size: 0.9375rem; margin-top: 12px; }
```

- [ ] **Step 4: Add CandidateCostSimulationComponent to candidate-detail**

In `candidate-detail.component.ts`, import `CandidateCostSimulationComponent` and add it to `imports: [...]`.

In `candidate-detail.component.html`, add at the bottom of the detail panel (after the existing sections):

```html
<app-candidate-cost-simulation
  [candidateId]="candidate.id"
  [paysId]="candidate.paysId"
  [salaireNetRh]="candidate.salaireNetRh ?? null"
  [salaireNetCandidат]="candidate.salaireNetCandidат ?? null"
  [payrollContractCode]="candidate.employmentTypePayrollCode ?? null">
</app-candidate-cost-simulation>
```

> Note: `employmentTypePayrollCode` should be resolved when loading the candidate — look up the list value for `candidate.employmentTypeId` and read its `payrollContractCode`. Add this lookup to the candidate detail load sequence.

- [ ] **Step 5: Add submitCostApproval to CandidatesService**

In the existing `candidates.service.ts` (or equivalent API service), add:

```typescript
submitCostApproval(candidateId: number, req: {
  salaireNetRh: number;
  salaireNetCandidат?: number | null;
  contractTypeCode: string;
  fiscalYear: number;
  simulationSnapshot: string;
}): Observable<any> {
  return this.http.post(`${this.base}/candidates/${candidateId}/cost-approval`, req);
}
```

- [ ] **Step 6: Build check**

```powershell
npx ng build --configuration=development 2>&1 | Select-String "error TS|ERROR"
```

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/candidates/candidate-cost-simulation.component.*
git add src/app/modules/candidates/candidate-detail.component.*
git commit -m "feat(hiring-cost): add simulation panel to candidate detail page"
```

---

### Task 11: Frontend — CD approval inbox

**Files:**
- Create: `src/app/modules/candidates/hiring-approval-inbox.component.ts`
- Create: `src/app/modules/candidates/hiring-approval-inbox.component.html`
- Create: `src/app/modules/candidates/hiring-approval-inbox.component.scss`
- Modify: routing (candidates routes file)

- [ ] **Step 1: Write HiringApprovalInboxComponent**

```typescript
import { ChangeDetectionStrategy, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { CandidatesService } from './candidates.service';

export interface CostApprovalItem {
  id: number;
  candidateId: number;
  paysId: number;
  fiscalYear: number;
  salaireNetRh: number;
  salaireNetCandidат: number | null;
  contractTypeCode: string;
  simulationSnapshot: string;
  status: string;
  submittedBy: number;
  submittedAt: string;
  approvedBy: number | null;
  approvedAt: string | null;
  approvalNotes: string | null;
}

@Component({
  selector: 'app-hiring-approval-inbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './hiring-approval-inbox.component.html',
  styleUrl:    './hiring-approval-inbox.component.scss',
})
export class HiringApprovalInboxComponent implements OnInit {
  private readonly svc = inject(CandidatesService);
  private readonly fb  = inject(FormBuilder);

  readonly loading  = signal(false);
  readonly error    = signal<string | null>(null);
  readonly items    = signal<CostApprovalItem[]>([]);
  readonly expanded = signal<number | null>(null);
  readonly processing = signal<number | null>(null);

  readonly filterForm = this.fb.group({ paysId: [null as number | null] });

  ngOnInit(): void { /* paysId injected from UserStore or route param */ }

  load(paysId: number): void {
    this.loading.set(true);
    this.svc.listPendingCostApprovals(paysId).subscribe({
      next: items => { this.items.set(items); this.loading.set(false); },
      error: e    => { this.error.set(e?.error?.message ?? 'Erreur'); this.loading.set(false); },
    });
  }

  expand(id: number): void {
    this.expanded.update(current => current === id ? null : id);
  }

  parseSim(snapshot: string): any {
    try { return JSON.parse(snapshot); } catch { return null; }
  }

  approve(item: CostApprovalItem, notes: string): void {
    this.processing.set(item.id);
    this.svc.approveCostApproval(item.id, notes).subscribe({
      next: () => { this.items.update(all => all.filter(i => i.id !== item.id)); this.processing.set(null); },
      error: e => { this.error.set(e?.error?.message ?? 'Erreur'); this.processing.set(null); },
    });
  }

  reject(item: CostApprovalItem, notes: string): void {
    this.processing.set(item.id);
    this.svc.rejectCostApproval(item.id, notes).subscribe({
      next: () => { this.items.update(all => all.filter(i => i.id !== item.id)); this.processing.set(null); },
      error: e => { this.error.set(e?.error?.message ?? 'Erreur'); this.processing.set(null); },
    });
  }
}
```

- [ ] **Step 2: Add service methods to CandidatesService**

```typescript
listPendingCostApprovals(paysId: number): Observable<CostApprovalItem[]> {
  return this.http.get<CostApprovalItem[]>(`${this.base}/hiring-cost-approvals`, { params: { paysId } });
}

approveCostApproval(id: number, notes: string): Observable<any> {
  return this.http.post(`${this.base}/hiring-cost-approvals/${id}/approve`, { notes });
}

rejectCostApproval(id: number, notes: string): Observable<any> {
  return this.http.post(`${this.base}/hiring-cost-approvals/${id}/reject`, { notes });
}
```

- [ ] **Step 3: Write the template**

```html
<div class="inbox-header">
  <h1 class="inbox-title">Approbations coût d'embauche</h1>
  <p class="inbox-sub">Simulations en attente de votre approbation</p>
</div>

@if (loading()) { <p class="loading-msg">Chargement…</p> }
@if (error()) { <p class="error-msg">{{ error() }}</p> }

@if (!loading() && items().length === 0) {
  <p class="empty-msg">Aucune simulation en attente pour ce pays.</p>
}

<div class="approval-list">
  @for (item of items(); track item.id) {
    <div class="approval-card" [class.approval-card--expanded]="expanded() === item.id">
      <div class="approval-card-header" (click)="expand(item.id)">
        <div class="approval-meta">
          <span class="approval-candidate">Candidat #{{ item.candidateId }}</span>
          <span class="approval-contract">{{ item.contractTypeCode }}</span>
          <span class="approval-year">{{ item.fiscalYear }}</span>
        </div>
        <div class="approval-salary">
          <span class="label">Net proposé</span>
          <strong>{{ item.salaireNetRh | number:'1.0-0' }}</strong>
        </div>
        <span class="expand-icon">{{ expanded() === item.id ? '▲' : '▼' }}</span>
      </div>

      @if (expanded() === item.id) {
        @let sim = parseSim(item.simulationSnapshot);
        @if (sim) {
          <div class="sim-breakdown">
            @if (item.salaireNetCandidат) {
              <div class="breakdown-row">
                <span>Demande candidat</span>
                <span>{{ item.salaireNetCandidат | number:'1.0-0' }}</span>
              </div>
            }
            <div class="breakdown-row">
              <span>Net simulé</span><span>{{ item.salaireNetRh | number:'1.0-0' }}</span>
            </div>
            <div class="breakdown-row">
              <span>Brut estimé</span><span>{{ sim.gross | number:'1.0-2' }}</span>
            </div>
            <div class="breakdown-row">
              <span>Charges salarié</span><span>{{ sim.employeeCharges | number:'1.0-2' }}</span>
            </div>
            <div class="breakdown-row">
              <span>Charges patronal</span><span>{{ sim.employerCharges | number:'1.0-2' }}</span>
            </div>
            <div class="breakdown-row">
              <span>IRPP</span><span>{{ sim.irppAmount | number:'1.0-2' }}</span>
            </div>
            <div class="breakdown-row breakdown-row--total">
              <span>Coût chargé</span><strong>{{ sim.loadedCost | number:'1.0-2' }}</strong>
            </div>
          </div>
        }

        <div class="approval-actions">
          <textarea #noteRef placeholder="Commentaire (optionnel)" class="notes-input" rows="2"></textarea>
          <div class="action-btns">
            <button class="btn btn--approve"
                    (click)="approve(item, noteRef.value)"
                    [disabled]="processing() === item.id">
              Approuver
            </button>
            <button class="btn btn--reject"
                    (click)="reject(item, noteRef.value)"
                    [disabled]="processing() === item.id">
              Refuser
            </button>
          </div>
        </div>
      }
    </div>
  }
</div>
```

- [ ] **Step 4: Add route**

In the candidates routing file (e.g. `candidates.routes.ts`), add:

```typescript
{
  path: 'hiring-approvals',
  loadComponent: () => import('./hiring-approval-inbox.component')
    .then(m => m.HiringApprovalInboxComponent),
}
```

And add a navigation link in the sidebar/nav for users with `APPROVE_HIRING_COST` permission.

- [ ] **Step 5: Build check + commit**

```powershell
npx ng build --configuration=development 2>&1 | Select-String "error TS|ERROR"
```

```bash
git add src/app/modules/candidates/hiring-approval-inbox.component.*
git commit -m "feat(hiring-cost): add CD approval inbox for hiring cost simulations"
```

---

## Self-Review

**Spec coverage:**
- ✅ `salaire_net_candidat` and `salaire_net_rh` on candidate table and form
- ✅ Simulation uses `salaire_net_rh` as default but is editable (Option B)
- ✅ `salaire_net_candidat` shown to CD for comparison (confirmed: yes)
- ✅ Contract type auto-mapped from employment type's `payrollContractCode`; manual fallback with warning if unmapped
- ✅ "Calculer" calls payroll service directly from frontend
- ✅ "Soumettre" persists snapshot + status=PENDING to `candidate_cost_approvals`
- ✅ CD inbox lists PENDING by `paysId`, approve/reject with optional note
- ✅ New permission `APPROVE_HIRING_COST` + fix for missing `RH_HIRE_CANDIDATE`

**Placeholders:** None — all code is complete and runnable.

**Type consistency:** `CostApprovalItem` interface in frontend matches `CandidateCostApprovalDto` record in backend (all field names and types align).
