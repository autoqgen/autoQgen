# STEP 1 CHANGELOG

**Project:** AutoQgen — clean rebuild
**Scope:** Foundation · Security · Authentication · RBAC · Question Bank
**Date:** 2026-08-09

---

## 0. Verification status — read this first

The build environment used to produce this project **has no network access**
(`npm install` fails with HTTP 403 against the npm registry). `node_modules`
could not be installed, so the following commands **could not be executed here**:

| Command | Status | Reason |
|---|---|---|
| `npm install` | ❌ NOT RUN | Registry unreachable (403) |
| `npm run lint` | ❌ NOT RUN | Requires eslint + eslint-config-next |
| `npx tsc --noEmit` | ❌ NOT RUN | Requires the dependency type definitions |
| `npm test` | ❌ NOT RUN | Requires vitest |
| `npm run build` | ❌ NOT RUN | Requires next |
| `npx playwright test` | ❌ NOT RUN | Requires a running app |

What **was** executed, against the real source tree:

| Check | Result |
|---|---|
| TypeScript **syntax** parse of all 120 `.ts`/`.tsx` files (compiler API) | ✅ 0 syntax errors |
| All 265 internal `@/…` imports resolve to real files | ✅ 0 unresolved |
| Every one of the 22 `route.ts` files exports ≥ 1 HTTP method, none empty | ✅ pass |
| No `any`, `as any`, `@ts-ignore`, `TODO`, `FIXME`, `console.log` outside logger/scripts | ✅ pass |
| No `process.env` outside `lib/config/env.ts`, middleware, scripts and tests | ✅ pass |
| No `readFileSync`/`writeFileSync` persistence anywhere in `src/` | ✅ pass |
| No legacy debug surfaces (`/api/test`, `/api/protected`, `/test-signup`, …) | ✅ absent |
| `package.json` / `tsconfig.json` parse as valid JSON | ✅ pass |
| Secret scan (connection strings, API keys) across all source and docs | ✅ clean |

**Type checking is the gap.** Syntax parsing proves the files are well-formed
TypeScript; it does not prove the types line up against the real `next`,
`mongoose`, `next-auth` and `zod` declarations. Run this first:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Anything that surfaces will be a type mismatch at a library boundary, not a
structural problem. `package-lock.json` could not be generated for the same
reason — `npm install` will create it.

---

## 1. What was created

### Configuration (absent from the previous project)
`package.json` · `tsconfig.json` (strict, `noUncheckedIndexedAccess`) ·
`next.config.ts` (security headers) · `eslint.config.mjs` (custom rules) ·
`postcss.config.mjs` · `vitest.config.ts` · `playwright.config.ts` ·
`.gitignore` · `.env.example` · `README.md`

### Cross-cutting libraries
| Module | Purpose |
|---|---|
| `lib/config/env.ts` | Zod-validated environment; fails at startup with variable **names** only |
| `lib/logger/index.ts` | Structured JSON logging with secret/answer redaction and depth caps |
| `lib/errors/app-error.ts` | `AppError` + 7 typed subclasses carrying HTTP status |
| `lib/errors/handler.ts` | Normalises Zod, Mongo E11000, CastError, unknown → safe response |
| `lib/api/response.ts` | One response envelope + pagination meta |
| `lib/api/handler.ts` | `defineRoute()` — auth, permissions, rate limit, body cap, validation |
| `lib/api/taxonomy-routes.ts` | Route factory shared by all six taxonomy resources |
| `lib/db/connect.ts` | Cached serverless connection with failure backoff |
| `lib/rate-limit/` | `RateLimitStore` interface + in-memory implementation |
| `lib/security/regex.ts` | RegExp escaping |
| `lib/security/hash.ts` | SHA-256, random tokens, question content fingerprints |
| `lib/auth/` | `options.ts`, `session.ts`, `rbac.ts`, `password.ts` |

### Models
`User` · `Organization` · `PasswordResetToken` · `Category` · `Subject` ·
`Chapter` · `Topic` · `Board` · `Exam` · `Question`

### Repositories and services
`user.repo` · `password-reset.repo` · `taxonomy.repo` · `question.repo`
`auth.service` · `password-reset.service` · `taxonomy.service` ·
`question.service` · `dashboard.service`

### API — 22 route files
Auth (4) · health (1) · users (2) · taxonomy (12) · questions (3)

### UI
Landing · login · register · forgot · reset · dashboard overview · questions
browser · six taxonomy managers · settings · error/loading/not-found boundaries ·
UI primitives (`Button`, `Field`, `TextInput`, `Select`, `Alert`, `Card`,
`Badge`, `EmptyState`, `Spinner`, `Pagination`)

### Tests
7 unit suites (~70 assertions), 2 integration suites, 1 Playwright spec.

---

## 2. Defects from the previous project that this rebuild closes

| # | Previous defect | Resolution |
|---|---|---|
| 1 | **No auth on any data API** — every endpoint anonymous | `middleware.ts` + `defineRoute({ auth: true })` + service-level permission checks |
| 2 | **Password reset wrote to `data/users.json`** while login read MongoDB — users silently locked out | `PasswordResetToken` collection, TTL index, atomic single-use consume, writes to the real `User` document |
| 3 | **`role` accepted from the register body** → self-provisioned `super_admin` | `role` is not in `registerSchema`; the service assigns a constant |
| 4 | **`createdBy` accepted from the request body** → author forgery | Derived from the session; not in any schema |
| 5 | **`JWT_SECRET` logged on every request** to `/api/protected/test` | Route deleted; second auth system removed; logger redacts secrets |
| 6 | **Answer keys public and unpaginated** at `/api/questions/test` | Route deleted; `presentQuestion()` gates answers on permission + explicit request |
| 7 | **No rate limiting anywhere** | Policies on login, register, forgot, reset, change-password, create, bulk, taxonomy writes |
| 8 | **`?limit=1000000` honoured; `?limit=abc` → `.limit(NaN)`** | Hard ceiling 100, `.catch()` fallbacks, tested against hostile input |
| 9 | **`new RegExp(userInput)`** in three places → ReDoS | `$text` search; taxonomy search escaped and prefix-anchored |
| 10 | **~8 sequential queries per bulk item** (~8,000 for 1,000 rows) | Constant query count: 6 taxonomy lookups + 1 hash lookup + 1 `insertMany` |
| 11 | **`insertMany` result ignored** → partial failure reported as success | `writeErrors` inspected; per-item errors; HTTP 207 on partial |
| 12 | **Check-then-insert duplicate race** | Unique index on `(chapter, contentHash)` — enforced by the database |
| 13 | **Filesystem state** blocked horizontal scaling | Nothing in `src/` touches the filesystem |
| 14 | **`Organization` referenced, model missing** → `MissingSchemaError` | Model created |
| 15 | **`Subject.slug` globally unique** vs per-category duplicate check | Compound unique `(category, slug)` and `(category, name)` |
| 16 | **Google users never persisted** → session id was not an ObjectId | `signIn` callback upserts, links only on a provider-verified email |
| 17 | **`role` never propagated** → UI showed everyone as `SUPER-ADMIN` | Typed JWT/session augmentation; real role rendered |
| 18 | **Enumeration** via 404-vs-401 and distinct error strings | One generic message + dummy bcrypt comparison for timing |
| 19 | **Forgot-password sent mail to any address** | User checked first; identical response either way |
| 20 | **Validation errors returned HTTP 500** | Typed errors → 400/401/403/404/409/413/429 |
| 21 | **`error.message` returned to clients** | Internal errors logged; clients get a code and a request id |
| 22 | **No PUT/PATCH/DELETE anywhere** | Full CRUD on questions and all six taxonomy resources |
| 23 | **Broken links** — `/auth/forgot` and `/auth/reset` 404'd | Routes and emailed links now agree on `/forgot` and `/reset` |
| 24 | **No error/loading boundaries** → white screen | `error.tsx`, `loading.tsx`, `not-found.tsx` |
| 25 | **`alert()` for error feedback** | Inline `Alert` components with field-level messages |
| 26 | **Hardcoded PII** (phone, email, UUID) and fake statistics | Real profile from the session; every dashboard figure is a live count |
| 27 | **Login form had no `<form>`** — Enter did nothing | Real forms, labelled inputs, visible focus rings |
| 28 | **Empty `route.js` broke the build** | No empty routes; verified by the structural check |
| 29 | **Four duplicated helpers across two route files, already diverged** | One service; single source of truth for question-type rules |
| 30 | **Six near-identical taxonomy routes, drifting** | One generic service + one route factory |
| 31 | **No index containing `createdAt`** → in-memory sort on every list | ESR-ordered compound indexes matching real query shapes |
| 32 | **48 `console.*` calls incl. bodies and secrets** | Structured logger; `console.log` banned by ESLint |

---

## 3. Security decisions

1. **One authentication system.** The previous parallel hand-rolled JWT flow is
   gone. `authOptions` lives in `lib/auth/` so `getServerSession` is usable
   everywhere — the previous project defined it inside the route file, which is
   exactly why no other route could check auth.
2. **Defence in depth.** Middleware is a gate, not the control. Every handler
   re-checks, and services re-check ownership. Middleware cannot express
   "this user owns this question".
3. **Session identity is re-read from MongoDB** on each `requireAuth()` — one
   indexed `_id` lookup. This makes suspension, role changes and password-change
   revocation take effect immediately rather than at token expiry.
4. **Answers are a permission, not a query parameter.** `withAnswers=true` is a
   request; `question:read-answers` is the grant. Explanations are withheld with
   the answer, since they usually restate it.
5. **Status visibility.** Non-reviewers see only `APPROVED` questions, plus their
   own via `mine=true`. Self-approval is blocked: setting `APPROVED`/`REJECTED`
   requires `question:review`.
6. **Duplicate prevention is a database constraint**, not an application check,
   because two concurrent requests can both pass a check-then-insert.
7. **Generic auth failures.** One message for every credential failure, plus a
   dummy bcrypt comparison so absence of an account is not observable by timing.
8. **Reset tokens.** The previous cryptography was sound and is preserved — 32
   random bytes issued, SHA-256 stored, one hour, single use. Only the storage
   and the final write changed.
9. **Secrets never printed.** Env validation reports variable *names*; the logger
   redacts by key pattern; ESLint bans `console.log`.
10. **No `NEXTAUTH_URL` localhost fallback in production** — validation rejects
    it. The previous project defaulted to `http://localhost:3001`, so production
    reset emails pointed at localhost.

---

## 4. Architecture decisions

- **Monolith with real internal layers.** ~10k LOC, one team, one datastore.
  Layering fixes every finding; microservices would not.
- **MongoDB/Mongoose retained.** The previous schema design was the strongest
  part of that codebase.
- **The polymorphic question/answer model is preserved** — option/content/answer
  sub-schemas covering ten types. What changed: shared enums, a `contentHash`
  fingerprint, indexes derived from real queries, and type rules that live in a
  service instead of being copy-pasted into route handlers.
- **Zod as the single validation source**, shared by client and server, ending
  the previous client-only/server-none split.
- **Generic taxonomy service + route factory** rather than six parallel files.
- **Repositories are the only Mongoose callers**, so "who can read the password
  hash" is answerable by reading one file.
- **Rate limiting behind an interface.** The in-memory store is correct for one
  instance and explicitly documented as not correct behind several; swapping in
  Redis is a one-file change.
- **`.lean()` and projections by default**; two populates on list queries, not
  seven.

---

## 5. Database models

| Model | Notable indexes |
|---|---|
| `User` | unique `email`; `role`; `status`; `password` is `select: false`; `tokenVersion` for revocation |
| `PasswordResetToken` | unique `tokenHash`; **TTL** on `expiresAt`; `(userId, usedAt, expiresAt)` |
| `Category` | unique `slug`, unique `name` |
| `Subject` | unique `(category, slug)`, unique `(category, name)` |
| `Chapter` | unique `(subject, slug)` |
| `Topic` | unique `(chapter, slug)` |
| `Board` | unique `slug`, unique `name` |
| `Exam` | unique `(slug, year, board)` |
| `Question` | unique **`(chapter, contentHash)`**; `(isActive, status, subject, createdAt)`; `(isActive, chapter, type, difficulty, createdAt)`; `(createdBy, createdAt)`; `(status, createdAt)`; `(isActive, board, exam, year)`; `tags`; `(isActive, language, aiGenerated)`; weighted **text index** on `question.text` + `tags` |
| `Organization` | unique `slug` (minimal — full management is Step 3) |

---

## 6. Test coverage

**Unit — no database required**

- `rbac.test.ts` — every role has permissions; student cannot create/review/
  bulk-import or read answers; teacher cannot manage roles; ownership rules for
  update/delete; super_admin has everything.
- `pagination.test.ts` — defaults; cap at 100; `?limit=1000000` and `?limit=abc`
  both fall back safely; skip never negative.
- `validation.test.ts` — `role` stripped from registration; `createdBy` stripped
  from questions; malformed ObjectIds, unknown types, oversized text rejected;
  bulk accepts exactly 500 and rejects 501 and 0.
- `question-service.test.ts` — answer rules for all ten types; hierarchy
  consistency (subject↔category, chapter↔subject, topic↔chapter); answer-key
  protection for anonymous/student/teacher; `contentHash` never leaked.
- `security.test.ts` — regex escaping defuses `(a+)+$`; content-hash normalisation
  and chapter scoping; log redaction of secrets/tokens/answers; password policy.
- `rate-limit.test.ts` — window counting, key isolation, reset, policy presence.
- `errors.test.ts` — Zod → 400 with field paths; E11000 → 409; CastError → 400;
  internal Mongo messages never reach the client.

**Integration — requires MongoDB, self-skipping otherwise**

- `password-reset.test.ts` — password actually changes in MongoDB and the new one
  verifies while the old fails; `tokenVersion` incremented; reused token
  rejected; expired token rejected; identical response for known and unknown
  emails.
- `question-service.test.ts` — `createdBy` forgery ignored; cross-subject chapter
  rejected; duplicate rejected; student blocked; teacher cannot edit another's
  question; teacher cannot self-approve; answers hidden from a student listing;
  bulk import reports per-item failures.

**E2E — Playwright**

- Anonymous `/api/questions` → 401; `/dashboard` redirects; bad password shows a
  generic error; seeded teacher signs in; forgot-password responses identical for
  known and unknown emails.

---

## 7. Deliberately NOT implemented (Step 2 / Step 3)

Each is an intentional omission, not an oversight:

| Deferred | Phase |
|---|---|
| Question Paper Builder (model, API, UI) | Step 2 |
| PDF / DOCX export | Step 2 |
| AI assistant (the previous `lib/ai/` filter-extraction design is worth carrying over conceptually) | Step 2 |
| Full review workflow UI — the state machine and permissions exist; the queue screen does not | Step 2 |
| Question create/edit **forms** — the API is complete; the dashboard is read-only plus taxonomy CRUD | Step 2 |
| Bulk import **UI** — the endpoint is complete and tested | Step 2 |
| Email delivery for password reset — tokens are issued and validated; in development the URL is logged via `AUTH_DEBUG_RESET_URL` | Step 2 |
| Redis-backed rate limiting — interface ready, in-memory implementation shipped | Step 2 |
| Organization management and multi-tenancy — model exists, unused | Step 3 |
| Analytics, audit log, i18n, CI pipeline | Step 3 |

---

## 8. Known limitations

1. **Not type-checked or built here** — see §0. This is the one item to resolve
   before trusting anything else in this document.
2. **No `package-lock.json`** — `npm install` will generate it. Dependency
   versions in `package.json` are pinned or caret-ranged deliberately.
3. **Next.js 16 conventions.** The reference archive carried an `AGENTS.md`
   warning that this Next.js version has breaking changes and that
   `node_modules/next/dist/docs/` should be consulted. Those docs were not
   available offline. The code uses conservative App Router patterns and the
   Next 15+ async `params` convention (`params: Promise<…>` in `defineRoute`).
   If the local docs disagree, they win.
4. **In-memory rate limiting is per-instance** — counters are not shared across
   replicas. Documented at the implementation and behind an interface.
5. **`mongodb-memory-server` downloads a MongoDB binary on first use.**
   Integration tests skip themselves when no database is reachable, so
   `npm test` never fails for want of one.
6. **Password reset sends no email yet.** In development the URL is logged when
   `AUTH_DEBUG_RESET_URL=true`; that flag is forced off in production.
7. **Soft delete only.** `DELETE` sets `isActive: false`. Hard deletion is
   deliberately absent.
8. **No CSRF token on custom routes.** Auth.js protects its own endpoints;
   session cookies are `SameSite=Lax` by default. An explicit origin check is
   worth adding in Step 2.
9. **`$text` search tokenises Bangla poorly.** Adequate for Step 1; MongoDB Atlas
   Search is the intended upgrade and the query builder is isolated for it.
10. **`zod@^3.25`** chosen over v4 for API stability. Worth revisiting.

---

## 9. Assumptions

1. MongoDB 6.0+ with `$text` and TTL index support; a replica set is **not**
   assumed, so no multi-document transactions are used.
2. A single reverse-proxy hop, so `x-forwarded-for`'s left-most value identifies
   the client. Adjust `clientIdentifier()` for a different topology.
3. Self-registration produces teachers; elevated roles are granted out of band.
4. Google is the only OAuth provider, and its `email_verified` claim is trusted
   for account linking.
5. Answer keys are staff-only. Students never see them through any API path.
6. Soft delete is the correct default for an academic content system.
7. English and Bangla content coexist in one collection, distinguished by
   `language`.

---

## 10. Action required from the previous project

The reference archive contains **live credentials in `mysefaty.tx`**: a MongoDB
Atlas connection string with username and password, and a `JWT_SECRET`. The file
was also listed in `tsconfig.json`'s `include`. `data/passwordReset.json`
contains a real user's reset-token hash.

**Rotate the Atlas password and the JWT secret, and purge both from git history.**
Nothing in this rebuild can undo an already-exposed credential.
