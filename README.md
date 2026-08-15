# AutoQgen

Question bank and exam management for teachers, in Bangla and English.

**Step 2 complete.** The platform now covers the full path from question bank to
finished exam paper: manual and automatic paper building, the paper lifecycle
(draft → published → archived) with version tracking, PDF and DOCX export in
student and teacher variants, question authoring and review UI, bulk import,
password-reset email delivery, CSRF origin validation, an audit trail, and a
Redis-ready rate limiter.

Step 1 delivered the foundation — configuration, database layer, authentication,
RBAC, taxonomy, the question bank — and remains unchanged in shape. See
`STEP1_CHANGELOG.md` and `STEP2_CHANGELOG.md`.

---

## Requirements

| Tool | Version |
|---|---|
| Node.js | ≥ 20.9 |
| MongoDB | ≥ 6.0 (local, Docker, or Atlas) |
| npm | ≥ 10 |

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then edit the values
npm run seed                   # development data + accounts
npm run dev                    # http://localhost:3000
```

Generate a secret for `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

A local MongoDB via Docker:

```bash
docker run -d --name autoqgen-mongo -p 27017:27017 mongo:7
```

### Seeded development accounts

Created by `npm run seed`, using `SEED_PASSWORD` (default `DevPassword123!`).
**Development only** — the seed script refuses to run when `NODE_ENV=production`.

| Role | Email |
|---|---|
| `super_admin` | admin@autoqgen.local |
| `teacher` | teacher@autoqgen.local |
| `reviewer` | reviewer@autoqgen.local |
| `student` | student@autoqgen.local |

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (unit + integration) |
| `npm run test:unit` | Unit tests only — no database needed |
| `npm run test:integration` | Integration tests — needs MongoDB |
| `npm run e2e` | Playwright auth smoke tests |
| `npm run seed` | Seed development data |
| `npm run verify` | lint → typecheck → test → build |

---

## Architecture

```
middleware.ts          edge auth gate for /dashboard and /api
  ↓
app/api/**/route.ts    transport only, built with defineRoute()
  ↓
lib/validation/        Zod schemas — shared by client and server
  ↓
lib/services/          business rules, authorization, workflow
  ↓
lib/repositories/      the only modules that touch Mongoose
  ↓
models/                schemas and indexes
```

Cross-cutting: `lib/config` (typed env), `lib/logger` (redacting), `lib/errors`
(typed errors → HTTP status), `lib/auth` (Auth.js options, session, RBAC,
passwords), `lib/rate-limit` (pluggable store), `lib/security` (regex escaping,
hashing).

Route handlers stay thin because `defineRoute` centralises rate limiting, the
database connection, body-size limits, schema validation, authentication,
permission checks and error normalisation.

---

## Security model

| Control | Where |
|---|---|
| Authentication | Auth.js (JWT), `lib/auth/options.ts` — one system, no parallel JWT path |
| Route gate | `middleware.ts` (edge) **and** re-checked in every handler |
| Authorization | Permission matrix in `lib/auth/rbac.ts`, enforced in services |
| `createdBy` | Always the session user; not part of any request schema |
| Role on register | Server constant (`teacher`); `role` is not an accepted input field |
| Answer keys | Opt-in **and** permission-gated in `presentQuestion()` |
| Passwords | bcrypt cost 12, ≥ 12 characters, `select: false` on the field |
| Reset tokens | MongoDB with a TTL index, SHA-256 at rest, single-use, atomic consume |
| Enumeration | One generic credential error + a dummy bcrypt comparison for timing |
| Rate limiting | `lib/rate-limit` on login, register, forgot, reset, create, bulk |
| Regex | User input is never interpolated into `RegExp`; search uses `$text` |
| Pagination | Hard ceiling of 100, safe fallback on hostile input |
| Errors | Internal messages never returned; clients get a code plus a request id |
| Logs | Structured JSON, secrets/tokens/answers redacted, depth- and length-capped |
| CSRF | Origin/Referer/Sec-Fetch-Site validation on every state-changing request |
| Audit trail | Append-only `AuditLog` with a TTL, written on every mutation |
| Answer export | `variant=teacher` refused without `paper:export-answers` — never downgraded silently |

Roles, least privilege first: `student` → `content_writer` → `teacher` →
`reviewer` → `moderator` → `team_admin` → `organization_owner` → `super_admin`.

---

## API

All routes return one envelope:

```jsonc
{ "success": true,  "data": …, "meta": { … }, "requestId": "…" }
{ "success": false, "error": { "code": "…", "message": "…", "details": [ … ] }, "requestId": "…" }
```

| Method | Path | Permission |
|---|---|---|
| `POST` | `/api/auth/register` | public |
| `GET/POST` | `/api/auth/[...nextauth]` | public |
| `POST` | `/api/auth/forgot-password` | public |
| `POST` | `/api/auth/reset-password` | public |
| `GET` | `/api/health` | public |
| `GET/PUT` | `/api/users/me` | authenticated |
| `PUT` | `/api/users/me/password` | authenticated |
| `GET` | `/api/{categories,subjects,chapters,topics,boards,exams}` | `taxonomy:read` |
| `POST` | `/api/{…}` | `taxonomy:create` |
| `GET/PUT/DELETE` | `/api/{…}/[id]` | `taxonomy:read` / `:update` / `:delete` |
| `GET` | `/api/questions` | `question:read` |
| `POST` | `/api/questions` | `question:create` |
| `GET/PUT/DELETE` | `/api/questions/[id]` | read + ownership or elevated role |
| `POST` | `/api/questions/bulk` | `question:bulk-import` |
| `GET` | `/api/papers` | `paper:read` |
| `POST` | `/api/papers` | `paper:create` |
| `GET/PUT/DELETE` | `/api/papers/[id]` | read + ownership or elevated role |
| `POST` | `/api/papers/[id]/actions` | publish / archive / restore / clone |
| `PUT` | `/api/papers/generate` | `paper:create` — dry run, persists nothing |
| `POST` | `/api/papers/generate` | `paper:create` — generate and save |
| `GET` | `/api/papers/[id]/export` | `paper:export` (+ `paper:export-answers` for the teacher copy) |
| `GET` | `/api/audit` | `audit:read` |

Answer keys require `withAnswers=true` **and** the `question:read-answers`
permission. The flag alone grants nothing.

---

## Testing

```bash
npm run test:unit           # no database required
npm run test:integration    # needs MongoDB — see tests/integration/README.md
npm run e2e                 # needs a running, seeded app
```

Integration tests skip themselves when no database is reachable rather than
failing, so `npm test` is safe in a restricted environment.

---

## Bangla PDF export

pdf-lib's built-in fonts cannot render Bangla. Drop a TrueType font at
`public/fonts/NotoSansBengali-Regular.ttf` and it is embedded automatically.
Without it, PDF export falls back to Helvetica, substitutes unsupported
characters and sets `X-Export-Degraded: unicode-font-missing` on the response.
DOCX export is natively Unicode and needs no font file. See
`public/fonts/README.md`.

## Deliberately not in Step 2

AI assistant · organization management and multi-tenancy · analytics
dashboards · question-level version history · scheduled/background paper
generation · i18n · CI pipeline. See `STEP2_CHANGELOG.md` for the reasoning.
