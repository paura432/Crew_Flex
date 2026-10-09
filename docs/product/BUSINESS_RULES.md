# Business Rules

These rules are implemented in pure TypeScript under `src/domain/` and covered by
`src/domain/*.test.ts`. If code and this document disagree, it is a bug: fix one of them in the
same change.

## BR-1 Work Requirement

| Rule   | Statement                                                                           | Status                                 |
| ------ | ----------------------------------------------------------------------------------- | -------------------------------------- |
| BR-1.1 | `title` (3–120 chars) and `location` (2–80 chars) are required.                     | IMPLEMENTED                            |
| BR-1.2 | `headcount` is an integer, 1–50. `headcount = 0` is an **invalid requirement**.     | IMPLEMENTED                            |
| BR-1.3 | `endsAt` must be strictly after `startsAt`; max duration 366 days.                  | IMPLEMENTED                            |
| BR-1.4 | 1–20 qualifications, no duplicates, **at least one `hard`**.                        | IMPLEMENTED                            |
| BR-1.5 | `shift`: `day` · `night` · `split` · `flexible`. Informational in V0.               | IMPLEMENTED                            |
| BR-1.6 | `urgency`: `planned` · `urgent` · `aog`. Informational in V0.                       | IMPLEMENTED                            |
| BR-1.7 | `status`: `draft` · `open` · `covered` · `cancelled` · `closed`. Created as `open`. | IMPLEMENTED                            |
| BR-1.8 | Only organization `admin` / `manager` can create requirements.                      | IMPLEMENTED                            |
| BR-1.9 | Requirements are never hard-deleted; they move to `cancelled` / `closed`.           | PARTIAL (no status transitions UI yet) |

## BR-2 Qualification validity (per requirement)

A held qualification is evaluated **against the requirement period**, not against "today".

| Rule   | Statement                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| BR-2.1 | `status = withdrawn` is treated as **not held**.                                                                |
| BR-2.2 | `expiresAt` is a date. It is valid through the whole UTC day.                                                   |
| BR-2.3 | `expiresAt < date(startsAt)` → **expired**.                                                                     |
| BR-2.4 | `date(startsAt) ≤ expiresAt < date(endsAt)` → **expires during requirement** (not valid for the full period).   |
| BR-2.5 | `expiresAt = null` → no expiry.                                                                                 |
| BR-2.6 | Self-declared qualifications start as `verification_status = pending`. A professional can never set `verified`. |

## BR-3 Eligibility (hard filters) — `evaluateMatch()`

A candidate is **eligible** only if **every** check passes. Each failure produces a blocker.
No score can compensate a blocker.

| Check                         | Blocker code                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| Hard qualification not held   | `MISSING_HARD_QUALIFICATION`                                        |
| Held but not `verified`       | `HARD_QUALIFICATION_NOT_VERIFIED` (pending/rejected/expired status) |
| Expired before start          | `HARD_QUALIFICATION_EXPIRED`                                        |
| Expires inside the period     | `HARD_QUALIFICATION_EXPIRES_DURING_REQUIREMENT`                     |
| No availability at all        | `NOT_AVAILABLE`                                                     |
| Availability covers only part | `PARTIAL_AVAILABILITY` (with `coveredPercent`)                      |

**Hard requirements require `verified` status.** Self-declaration alone is not eligibility
(see `OPEN_DECISIONS.md` OD-3).

## BR-4 Availability

| Rule   | Statement                                                                                                                                                                                                       |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-4.1 | Availability is a set of time windows (`available` / `unavailable`), never a single boolean.                                                                                                                    |
| BR-4.2 | `unavailable` windows override `available` windows where they overlap.                                                                                                                                          |
| BR-4.3 | A candidate is available only if the union of `available` minus `unavailable` covers **100 %** of `[startsAt, endsAt)`.                                                                                         |
| BR-4.4 | **Partial overlap is NOT eligible in V0.** It is reported as `PARTIAL_AVAILABILITY` with the covered percentage so the UI can explain it. Partial coverage across several technicians is LATER (blueprint §06). |
| BR-4.5 | Adjacent/overlapping available windows merge.                                                                                                                                                                   |

## BR-5 Soft score

| Rule   | Statement                                                                                                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-5.1 | Score is computed **only for eligible candidates**; ineligible → `softScore = 0`.                                                                                            |
| BR-5.2 | A soft qualification is _met_ when held, not withdrawn, not rejected, and valid for the full period (BR-2). Pending verification counts as met but is flagged in the reason. |
| BR-5.3 | `softScore = round(100 × met / totalSoft)`; with no soft requirements `softScore = 100`.                                                                                     |
| BR-5.4 | Location, shift and experience are **informational** in V0 (displayed, not scored).                                                                                          |
| BR-5.5 | Results are ordered: eligible first, then `softScore` desc, then candidate id (stable).                                                                                      |

## BR-6 Capacity — `evaluateCapacity()`

```
required            = requirement.headcount            (must be ≥ 1, else InvalidRequirementError)
internallyEligible  = count(evaluateMatch(requirement, c).eligible for c in internal workforce)
gap                 = max(0, required − internallyEligible)
coveragePercent     = min(100, internallyEligible / required × 100), rounded to 2 decimals
```

- Capacity uses the **same** `evaluateMatch()` as matching. No second algorithm.
- Surplus is not negative gap: `required 2, eligible 3 → gap 0, coverage 100`.

## BR-7 Pools

| Pool     | Definition (V0)                                                                                                                                                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Internal | Technicians who are members (any role) of the requirement's organization.                                                                                                      |
| External | Technicians with `visibility ∈ {anonymous, open}`, not members of the organization, holding at least one of the requirement's qualification types. Max 100 evaluated per call. |

Internal candidates are named. External candidates are shown with a per-requirement pseudonymous
reference unless the professional chose `open` visibility.

## BR-8 Visibility

| Value       | Meaning                                                                  |
| ----------- | ------------------------------------------------------------------------ |
| `private`   | Default. Never appears in external matching.                             |
| `anonymous` | Matchable. Qualifications shown, identity hidden (pseudonymous ref).     |
| `open`      | Matchable. Display name visible. Contact still requires consent (LATER). |

## BR-9 Roles

Platform role (`profiles.platform_role`: `user` · `platform_admin`) is distinct from organization
role (`organization_members.role`: `member` · `manager` · `admin`). See `AUTHORIZATION.md`.
