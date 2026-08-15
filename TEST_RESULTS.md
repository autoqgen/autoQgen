# TEST_RESULTS.md

**Project:** AutoQgen — Step 2
**Date:** 2026-08-09
**Environment:** offline build sandbox, Node 20, no npm registry access

---

## 1. Headline

| Command required by the brief | Status |
|---|---|
| `npm install` | ❌ **NOT RUN** — registry returns HTTP 403 |
| `npm run typecheck` | ❌ **NOT RUN** — needs library type definitions |
| `npm run lint` | ❌ **NOT RUN** — needs eslint + eslint-config-next |
| `npm test` | ❌ **NOT RUN** — needs vitest |
| `npm run build` | ❌ **NOT RUN** — needs next |
| `npx playwright test` | ❌ **NOT RUN** — needs a running app |

I am not going to report these as passing. They were not executed.

The sandbox that produced this project has no outbound network, so
`node_modules` cannot be installed:

```
$ npm install --dry-run
npm error code E403
npm error 403 Forbidden - GET https://registry.npmjs.org/@playwright%2ftest
```

Everything below is what **was** actually executed against the real source tree,
plus the exact commands you should run first.

---

## 2. What was executed

### 2.1 TypeScript syntax parse — ✅ PASS

Every `.ts`/`.tsx` file parsed with the TypeScript compiler API (v6.0.3,
available globally in this sandbox), collecting syntactic diagnostics.

```
Parsed 167 files, 0 with syntax errors.
```

**What this proves:** every file is well-formed TypeScript and will parse in a
real build.
**What it does not prove:** that types line up against the real `next`,
`mongoose`, `next-auth`, `zod`, `pdf-lib`, `docx` and `nodemailer`
declarations. That is `npm run typecheck`, and it is the outstanding gap.

### 2.2 Structural and security static checks — ✅ PASS

```
Checked 167 files, 430 internal imports, 28 route files.
No structural problems found.
```

| Check | Result |
|---|---|
| Every internal `@/…` import resolves to a real file | ✅ 430/430 |
| Every `route.ts` exports ≥ 1 HTTP method | ✅ 28/28 |
| No zero-byte route files | ✅ |
| No `any`, `as any`, `@ts-ignore`, `TODO`, `FIXME` | ✅ |
| No `console.log` outside the logger, scripts and the error boundary | ✅ |
| No `process.env` outside `lib/config/env.ts`, middleware, scripts, tests | ✅ |
| No `writeFileSync` persistence anywhere in `src/` | ✅ |
| No legacy debug surfaces (`/api/test`, `/api/protected`, `/test-signup`) | ✅ |
| `package.json` / `tsconfig.json` valid JSON | ✅ |
| Secret scan (connection strings, API keys) across source and docs | ✅ clean |

### 2.3 Manual self-review — 5 defects found and fixed

With no compiler available, the code was read for the classes of error a
type-checker would normally catch. Five were real:

| # | Defect | Impact had it shipped |
|---|---|---|
| 1 | Duplicate import from `@/lib/errors/handler` in `api/handler.ts` | Lint failure |
| 2 | `.find(filter, projection)` followed by `.select()` in `question.repo.ts` | The `textScore` meta-projection would be silently overridden, breaking relevance sorting with no error |
| 3 | `useEffect` in `TaxonomyManager` depending on the whole `form` object | Every parent dropdown refetched on each keystroke |
| 4 | Unnecessary `as Permission` cast in `canActOnResource` | Suppressed a check template-literal types already perform |
| 5 | Invalid `sort` property passed to `taxonomyService.list` in the import page | Type error at build |

Defect 2 is the one worth noting: it is silent at runtime and would have produced
subtly wrong search ordering rather than an error.

---

## 3. Test suite inventory

Written and included, **not executed**. 152 assertions across 16 suites.

### 3.1 Unit — no database required (13 suites, 132 cases)

| Suite | Cases | Covers |
|---|---:|---|
| `rbac.test.ts` | 14 | Full matrix; students blocked from papers and answers; content writer can export but not the answer key; publish restricted to moderator+; paper ownership rules; audit restricted to team_admin+ |
| `question-service.test.ts` | 19 | Answer rules for all 10 types; hierarchy consistency; answer-key protection for anonymous/student/teacher; `contentHash` never leaked |
| `validation.test.ts` | 15 | `role` stripped from registration; `createdBy` stripped from questions; malformed ObjectIds, unknown types, oversized text; bulk accepts 500 and rejects 501 |
| `paper-schema.test.ts` | 12 | Server-derived fields stripped; quota sums validated; duplicate quotas rejected; export `variant` defaults to `student` on nonsense input |
| `csv-import.test.ts` | 12 | Quoted fields, escaped quotes, embedded newlines, CRLF, BOM, malformed rows; row→payload mapping; import always forced to `DRAFT` |
| `security.test.ts` | 11 | Regex escaping defuses `(a+)+$`; content-hash normalisation; log redaction; password policy |
| `paper-document.test.ts` | 10 | Student variant carries no answer or explanation; teacher variant does; continuous numbering; mark distribution; missing question degrades gracefully |
| `origin.test.ts` | 9 | Safe methods pass; same-origin allowed; cross-site blocked by Origin and by Referer; `Sec-Fetch-Site: cross-site` blocked without Origin; non-browser allowed |
| `paper-generator.test.ts` | 8 | Slot plan sums exactly; difficulty-only and type×difficulty crossing; never exceeds a quota; largest-remainder rounding; zero-count quotas dropped |
| `email.test.ts` | 7 | Token absent from the subject; HTML escaping of name and URL; both bodies present; expiry stated |
| `pagination.test.ts` | 5 | Defaults; 100 ceiling; `?limit=1000000` and `?limit=abc` fall back |
| `errors.test.ts` | 5 | Zod→400 with paths; E11000→409; CastError→400; internal Mongo messages never reach the client |
| `rate-limit.test.ts` | 5 | Window counting; key isolation; reset; policy presence |

### 3.2 Integration — requires MongoDB, self-skipping (3 suites, 20 cases)

| Suite | Cases | Covers |
|---|---:|---|
| `paper-service.test.ts` | 8 | Generation excludes unapproved questions and produces no duplicates; difficulty distribution honoured exactly; shortfall warns instead of silently truncating; unapproved question refused in a manual paper; same question twice rejected; totals computed server-side and version incremented; teacher blocked from publishing while moderator succeeds; clone is a fresh draft owned by the cloner |
| `question-service.test.ts` | 8 | `createdBy` forgery ignored; cross-subject chapter rejected; duplicate rejected; student blocked; teacher cannot edit another's question or self-approve; answers hidden from a student listing; bulk import reports per-item failures |
| `password-reset.test.ts` | 4 | Password actually changes in MongoDB and the old one stops working; `tokenVersion` incremented; reused and expired tokens rejected; identical response for known and unknown emails |

These skip themselves when no database is reachable, so `npm test` never fails
for want of one.

```bash
# Against a running MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/autoqgen-test npm run test:integration
# Or let mongodb-memory-server provision one (downloads a binary on first run)
USE_MEMORY_MONGO=true npm run test:integration
```

### 3.3 E2E — Playwright (1 spec, 5 cases)

Anonymous API returns 401 · dashboard redirects · bad password shows the generic
error · seeded teacher signs in · forgot-password responses identical for known
and unknown emails.

Requires a built, running, seeded app.

---

## 4. Coverage gaps I would close first

Honest about what is *not* covered:

1. **PDF and DOCX byte output.** The render **model** is well tested
   (`paper-document.test.ts`), but no test opens a generated file. A golden-file
   or `pdf-parse` assertion would catch layout regressions.
2. **Route-level integration.** Services are tested directly; no test drives a
   request through `defineRoute`, so origin validation and audit injection are
   verified in isolation rather than in the pipeline.
3. **Email transport.** Templates are tested; the SMTP transport is not — it
   needs an injected fake via the existing `setEmailTransport` seam.
4. **`RedisRateLimitStore`.** Untested; needs a fake `RedisLikeClient`. The
   interface exists precisely to make that easy.
5. **UI components.** No component tests. The forms are the largest untested
   surface; `QuestionForm`'s type-driven answer switching is the priority.
6. **Concurrency.** No test asserts that two simultaneous publishes or two
   concurrent identical bulk imports behave correctly.

---

## 5. What to run first

```bash
npm install
npm run typecheck      # ← the outstanding gap; start here
npm run lint
npm test
npm run build
npm run seed && npm run dev
```

**Expect type errors at library boundaries**, most likely in the four newly
integrated packages:

| Package | Where | Likely issue |
|---|---|---|
| `pdf-lib` / `@pdf-lib/fontkit` | `lib/export/pdf.ts` | `registerFontkit` typing; `PDFFont` variance |
| `docx` | `lib/export/docx.ts` | `Paragraph`/`TextRun` option names differ between major versions |
| `nodemailer` | `lib/email/index.ts` | `Transporter` generic parameter |
| `mongoose` | `paper.repo.ts` | Populated-document typing on `sections.questions.question` |

These are mechanical to fix and localised to four files. The structural checks
above give reasonable confidence that nothing deeper is wrong.

---

## 6. Summary table

| Category | Status |
|---|---|
| Syntax (167 files) | ✅ PASS |
| Import resolution (430) | ✅ PASS |
| Route handler exports (28) | ✅ PASS |
| Code-quality gates | ✅ PASS |
| Secret scan | ✅ PASS |
| Self-review defects | ✅ 5 found, 5 fixed |
| Test suites written | ✅ 16 suites, 152 cases |
| **Type check** | ⚠️ **NOT RUN** |
| **Lint** | ⚠️ **NOT RUN** |
| **Unit / integration tests** | ⚠️ **NOT RUN** |
| **Build** | ⚠️ **NOT RUN** |
| **E2E** | ⚠️ **NOT RUN** |
