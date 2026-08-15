# STEP 2 CHANGELOG

**Project:** AutoQgen — Question Bank → Auto Question Paper Generation Platform
**Scope:** Features 1–10 as specified
**Date:** 2026-08-09
**Baseline:** Step 1 (`STEP1_CHANGELOG.md`), treated as stable and preserved

---

## 0. Verification status — read this first

The build environment used to produce this project **still has no network
access** (`npm install` → HTTP 403 against the npm registry). `node_modules`
cannot be installed here, so the commands the brief asks for **could not be
executed**:

| Command | Status |
|---|---|
| `npm install` | ❌ NOT RUN — registry unreachable (403) |
| `npm run lint` | ❌ NOT RUN — requires eslint |
| `npm run typecheck` | ❌ NOT RUN — requires library type definitions |
| `npm test` | ❌ NOT RUN — requires vitest |
| `npm run build` | ❌ NOT RUN — requires next |

What **was** executed against the real source tree — see `TEST_RESULTS.md` for
the full output:

| Check | Result |
|---|---|
| TypeScript syntax parse, all 167 `.ts`/`.tsx` files | ✅ 0 errors |
| All 322 internal `@/…` imports resolve to real files | ✅ 0 unresolved |
| All 28 `route.ts` files export ≥ 1 HTTP method, none empty | ✅ pass |
| No `any` / `as any` / `@ts-ignore` / `TODO` / `console.log` outside logger and scripts | ✅ pass |
| No `process.env` outside `lib/config/env.ts`, middleware, scripts and tests | ✅ pass |
| No filesystem persistence in `src/` | ✅ pass |
| No legacy debug surfaces | ✅ absent |
| Secret scan across all source and docs | ✅ clean |

**Type checking against the real library declarations remains the outstanding
gap**, exactly as it was at the end of Step 1. Run this first:

```bash
npm install
npm run typecheck && npm run lint && npm test && npm run build
```

Anything that surfaces will be a type mismatch at a library boundary — most
likely in the four newly integrated packages (`pdf-lib`, `@pdf-lib/fontkit`,
`docx`, `nodemailer`) — not a structural problem.

---

## 1. Feature delivery

| # | Feature | Status | Where |
|---|---|---|---|
| 1 | Question Paper Builder (manual + auto) | ✅ Complete | model, repo, service, generator, validation, 5 APIs, builder UI |
| 2 | Paper management (create/edit/delete/clone/archive/publish/restore + versioning) | ✅ Complete | `paper.service.ts`, `/api/papers/[id]/actions` |
| 3 | Question create & edit UI | ✅ Complete | `QuestionForm`, `QuestionPreview`, 2 pages |
| 4 | Review workflow UI | ✅ Complete | `ReviewQueue`, `/dashboard/review` |
| 5 | Bulk import UI (CSV + JSON) | ✅ Complete | `BulkImport`, `lib/import/csv.ts` |
| 6 | PDF export (student + teacher) | ✅ Complete | `lib/export/pdf.ts` |
| 7 | DOCX export (matching structure) | ✅ Complete | `lib/export/docx.ts` |
| 8 | Password reset email delivery | ✅ Complete | `lib/email/`, wired into the existing token flow |
| 9 | Security hardening (CSRF, origin, audit, validation) | ✅ Complete | `lib/security/origin.ts`, `AuditLog`, `audit.service.ts` |
| 10 | Performance architecture (Redis, large banks, efficient generation) | ✅ Complete | `redis-store.ts`, `$sample` bucketing, new indexes |

---

## 2. New files (46)

### Domain and types
- `src/types/paper.ts` — statuses, modes, export formats, transition map
- `src/models/QuestionPaper.ts` — sections, question snapshots, generation spec, version history
- `src/models/AuditLog.ts` — append-only trail with a two-year TTL

### Validation
- `src/lib/validation/paper.schema.ts` — create/update/generate/action/list/export schemas

### Repositories
- `src/lib/repositories/paper.repo.ts`
- `src/lib/repositories/audit.repo.ts`

### Services
- `src/lib/services/paper.service.ts` — CRUD, lifecycle, clone, versioning
- `src/lib/services/paper-generator.service.ts` — constrained sampling
- `src/lib/services/paper-export.service.ts` — export authorization and orchestration
- `src/lib/services/audit.service.ts`

### Export
- `src/lib/export/paper-document.ts` — format-neutral render model
- `src/lib/export/pdf.ts`
- `src/lib/export/docx.ts`
- `src/lib/export/fonts.ts` — optional Unicode font embedding

### Email
- `src/lib/email/types.ts`, `src/lib/email/index.ts`
- `src/lib/email/templates/password-reset.ts`

### Security and performance
- `src/lib/security/origin.ts` — CSRF origin validation
- `src/lib/rate-limit/redis-store.ts` — driver-agnostic Redis store

### Import
- `src/lib/import/csv.ts` — RFC 4180 parser, template, row mapper

### API routes (7)
`/api/papers`, `/api/papers/[id]`, `/api/papers/[id]/actions`,
`/api/papers/generate`, `/api/papers/[id]/export`, `/api/audit`

### UI (11)
- `components/questions/QuestionForm.tsx`, `QuestionPreview.tsx`, `BulkImport.tsx`
- `components/review/ReviewQueue.tsx`
- `components/papers/PaperList.tsx`, `PaperBuilder.tsx`, `PaperDetail.tsx`
- pages: `/dashboard/papers`, `/dashboard/papers/new`, `/dashboard/papers/[id]`,
  `/dashboard/questions/new`, `/dashboard/questions/[id]/edit`,
  `/dashboard/questions/import`, `/dashboard/review`

### Tests (6 new suites)
`paper-generator`, `paper-schema`, `paper-document`, `origin`, `csv-import`,
`email` (unit) and `paper-service` (integration)

### Docs
`STEP2_CHANGELOG.md`, `IMPLEMENTATION_SUMMARY.md`, `UPDATED_ARCHITECTURE.md`,
`TEST_RESULTS.md`, `public/fonts/README.md`

---

## 3. Modified files (17)

| File | Change |
|---|---|
| `src/lib/auth/rbac.ts` | 10 new permissions; `canActOnResource` generalised to take a resource; `canExportAnswers` added |
| `src/lib/config/env.ts` | SMTP, `EMAIL_FROM`, `EMAIL_SUPPORT`, `ALLOWED_ORIGINS`, `REDIS_URL`; `allowedOrigins` export |
| `src/lib/api/handler.ts` | Origin validation before rate limiting; `audit` context injected into every handler |
| `src/lib/rate-limit/index.ts` | `setRateLimitStore()`; three new policies |
| `src/lib/repositories/question.repo.ts` | `sample()`, `countByBucket()`, `findForPaper()` |
| `src/lib/services/question.service.ts` | Optional audit context on create/update/delete/bulk |
| `src/lib/services/taxonomy.service.ts` | Optional audit context on create/update/deactivate |
| `src/lib/services/password-reset.service.ts` | Sends the reset email and a password-changed notification |
| `src/models/index.ts` | Exports `QuestionPaper` and `AuditLog` |
| `src/components/dashboard/Sidebar.tsx` | Five new navigation entries |
| API routes (6) | Pass the audit context through to services |
| `package.json` | 4 runtime deps, 1 dev dep, version 2.0.0-step2 |
| `.env.example` | Step 2 variables, documented |
| `README.md` | Step 2 endpoints, security table, Bangla PDF note |
| `tests/unit/rbac.test.ts` | 6 new paper/audit permission cases |

**No Step 1 file was rewritten or removed.** Every change is additive or an
optional parameter, so existing call sites keep working unchanged.

---

## 4. Design decisions

### 4.1 Auto generation is constrained sampling, not a loop

Two marginal distributions (difficulty, type) must both hold. The generator:

1. **Expands them into a joint slot plan** (`buildSlotPlan`). Type quotas are
   spread across difficulty quotas by largest-remainder allocation, so "10 MCQ"
   plus "6 EASY / 4 HARD" yields 6 easy MCQs and 4 hard MCQs rather than an
   arbitrary mix. The allocation always sums exactly — it is pure and unit-tested
   in isolation.
2. **Issues one `$sample` aggregation per distinct bucket**, excluding the
   running selection. Buckets are bounded by 10 types × 4 difficulties, so cost
   is a small constant regardless of bank size or paper length.
3. **Backfills in two relaxation passes** (drop type, then drop difficulty) and
   **reports what it could not satisfy** rather than quietly returning a short
   paper.

Duplicates are impossible by construction: every bucket query carries `$nin` over
the running selection, and the result is de-duplicated again.

### 4.2 Marks are snapshotted, questions are referenced

A paper stores a question **reference** plus the **marks used at build time**.
The reference keeps papers in step with content corrections; the snapshot keeps
the mark total stable when a question's default marks are later edited. Totals
are always recomputed server-side — `totalMarks` and `totalQuestions` are not in
any input schema.

### 4.3 One render model, two formats

`buildRenderedPaper()` produces a format-neutral document that both exporters
consume. This is what makes "DOCX matches the PDF structure" a structural
guarantee rather than a promise, and it means the on-screen paper preview is
built from the same projection as the exported file.

### 4.4 Answer exports are refused, not downgraded

Requesting `variant=teacher` without `paper:export-answers` returns 403. Silently
returning the student copy would hand someone a file they believe contains
answers. The authorization check also runs **before** the paper is loaded, so an
answer key is never read into memory for an unauthorised caller.

### 4.5 Origin validation as the CSRF control

Auth.js protects its own endpoints with a double-submit token. Everything else is
a JSON API consumed by same-origin `fetch`, so the correct control is to require
a trusted `Origin`/`Referer`/`Sec-Fetch-Site` on state-changing requests. This
holds because `defineRoute` already rejects any body that is not
`application/json` — a cross-site form POST cannot set that content type without
a CORS preflight, and an attacker's page cannot forge either header.

Non-browser clients (curl, server-to-server) send none of the three headers and
are allowed; a browser never omits all three on a cross-site request.

The check runs **before** rate limiting, so a cross-site flood cannot consume a
victim's budget or reach the database.

### 4.6 Auditing never breaks the operation it describes

`auditService.record()` catches and logs its own failures. Metadata is limited to
ids, counts and status transitions — never answers, passwords or tokens. The
repository exposes no update or delete method, so the trail cannot be rewritten
through the application, and a TTL index expires entries after two years.

### 4.7 Redis without a Redis dependency

`RedisRateLimitStore` is written against a four-method `RedisLikeClient`
interface, so the project takes on no driver dependency and ioredis, node-redis
or an Upstash HTTP client all work:

```ts
setRateLimitStore(new RedisRateLimitStore(new Redis(process.env.REDIS_URL)));
```

Routes are untouched — they only ever call `enforceRateLimit`.

### 4.8 CSV parsing written by hand

80 auditable lines instead of a transitive dependency tree on a
security-sensitive path. Handles quoted fields, escaped quotes, embedded commas
and newlines, CRLF and BOM. The mapper deliberately does **not** validate —
duplicating server rules client-side would recreate exactly the divergence the
Step 1 rebuild removed. Imported rows are always forced to `DRAFT`, so import
cannot smuggle content past review.

### 4.9 Large imports are chunked client-side

The endpoint caps a request at 500 questions. The UI slices a larger file into
sequential batches with visible progress and remaps error indices back to
original file rows. Sequential rather than parallel keeps database load
predictable and stays inside the import rate limit.

---

## 5. New permissions

| Permission | student | content_writer | teacher | reviewer | moderator | team_admin | org_owner | super_admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `paper:read` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `paper:create` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `paper:update:own` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `paper:update:any` | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `paper:delete:own` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `paper:delete:any` | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `paper:publish` | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `paper:export` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `paper:export-answers` | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `audit:read` | — | — | — | — | — | ✅ | ✅ | ✅ |

A content writer can build and export a paper but cannot obtain the answer key —
the distinction that makes the student/teacher variant split meaningful.

---

## 6. Database changes

### `QuestionPaper` (new)
```
{ isActive, createdBy, updatedAt }          — "my papers"
{ isActive, status, updatedAt }             — status browsing
{ isActive, subject, status, updatedAt }    — subject-scoped lists
{ isActive, board, exam, year }             — past-paper lookups
{ title: "text" }                           — title search
```

### `AuditLog` (new)
```
{ createdAt: -1 }
{ actor, createdAt: -1 }
{ action, createdAt: -1 }
{ resourceType, resourceId, createdAt: -1 }
{ createdAt: 1 } TTL 63,072,000s (2 years)
```

No existing collection or index was modified. `autoIndex` remains on outside
production; in production, create the two new collections' indexes as part of the
deploy.

---

## 7. Migration notes

1. `npm install` — four new runtime dependencies.
2. New environment variables are all optional; without SMTP the console transport
   runs and logs a production error. Nothing breaks if `.env.local` is unchanged.
3. Two new collections are created on first write. No backfill and no data
   migration is needed.
4. **Existing sessions keep working** — no auth or session change.
5. Optional: drop a Bangla TTF at `public/fonts/` for Bangla PDF export.
6. Optional: wire `RedisRateLimitStore` for multi-instance rate limiting.

---

## 8. Deliberately NOT implemented

| Deferred | Reason |
|---|---|
| AI assistant / AI paper generation | Step 3; the old `lib/ai/` filter-extraction design remains the right reference |
| Organization management, multi-tenancy | Step 3; the `Organization` model exists but is unused |
| Analytics dashboards | Step 3 |
| Question-level version history | Papers version; questions keep `updatedBy`/`approvedBy` only |
| Background/queued paper generation | Generation is fast enough inline at the current cap of 500 questions; the service is structured so a queue can wrap it |
| Section editing in the manual builder UI | The model and API support multiple sections; the UI writes a single section |
| Reordering questions on a **saved** paper | The API accepts a reordered `sections` payload; the detail screen is read-only |
| i18n | Step 3 |
| CI pipeline | Step 3 |

---

## 9. Known limitations

1. **Not type-checked or built here** (§0). This is the one item to resolve first.
2. **Bangla PDF needs a font file.** Without it the exporter substitutes
   characters and sets `X-Export-Degraded`. DOCX is unaffected.
3. **PDF bold reuses the embedded regular weight** when a Unicode font is loaded,
   since only one weight is embedded. Layout is unaffected.
4. **In-memory rate limiting is still the default** — per-instance until Redis is
   wired.
5. **`totalMarks` is a target, not a constraint.** The generator reports a
   mismatch rather than reshuffling to hit an exact total; forcing it would mean
   rejecting valid questions or silently altering marks.
6. **Email delivery is best-effort by design.** A transport failure never changes
   the forgot-password response, or the endpoint becomes an enumeration oracle
   again.
7. **No multi-document transactions** — a replica set is not assumed, as in
   Step 1. Paper writes are single-document and therefore atomic anyway.
8. **Audit metadata is `Mixed`.** Services pass small summaries by convention;
   there is no schema-level guarantee.
9. **Client-side chunked import is not resumable.** A mid-import failure reports
   which batch failed; already-imported batches are not rolled back.
