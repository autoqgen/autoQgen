# UPDATED_ARCHITECTURE.md

**Project:** AutoQgen
**As of:** Step 2 (2026-08-09)
**Supersedes:** the Step 1 architecture section of `README.md`

---

## 1. System overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Browser (React 19)                          │
│   Auth · Dashboard · Question authoring · Review · Paper builder      │
└───────────────┬──────────────────────────────────────────────────────┘
                │ same-origin fetch (JSON) + <a> download for exports
┌───────────────▼──────────────────────────────────────────────────────┐
│                    middleware.ts  (edge runtime)                     │
│    session gate · public allowlist · dashboard redirect              │
├──────────────────────────────────────────────────────────────────────┤
│                    defineRoute()  (node runtime)                     │
│  origin/CSRF → rate limit → db connect → params/query/body validation│
│  → auth → permission → handler → error normalisation → envelope      │
├──────────────────────────────────────────────────────────────────────┤
│  SERVICES   auth · password-reset · taxonomy · question              │
│             paper · paper-generator · paper-export · audit · dashboard│
├──────────────────────────────────────────────────────────────────────┤
│  REPOSITORIES   user · password-reset · taxonomy · question          │
│                 paper · audit          ← only Mongoose callers        │
├──────────────────────────────────────────────────────────────────────┤
│  MODELS   User · Organization · PasswordResetToken · Category ·      │
│           Subject · Chapter · Topic · Board · Exam · Question ·      │
│           QuestionPaper ★ · AuditLog ★                                │
└───────┬──────────────────┬───────────────────┬───────────────────────┘
        │                  │                   │
   MongoDB Atlas      SMTP (nodemailer)   Redis (optional, injected)
                                          
  Export pipeline:  paper-document → pdf-lib | docx   (no browser, no service)
```
★ = new in Step 2. Nothing above it changed shape.

---

## 2. Layer responsibilities

| Layer | Responsibility | Step 2 additions |
|---|---|---|
| Edge middleware | Session presence, public allowlist | unchanged |
| `defineRoute` | Transport concerns, uniformly | **origin validation**, **audit context injection** |
| Validation | Structural shape only | `paper.schema.ts` |
| Services | Business rules, authorization, workflow | paper, generator, export, audit |
| Repositories | Data access, projections, batching | paper, audit; `sample`/`countByBucket`/`findForPaper` on question |
| Models | Schema, indexes, constraints | `QuestionPaper`, `AuditLog` |
| Cross-cutting | config, logger, errors, auth, rate limit, security | email, origin, Redis store, CSV, export |

The rule from Step 1 still holds: **route handlers contain no business logic, and
services never call Mongoose directly.**

---

## 3. Request pipeline (updated)

`defineRoute` now runs seven ordered stages:

```
1. Origin validation      ← NEW. Rejects cross-site writes before anything else,
                            so a flood cannot consume rate budget or hit the DB.
2. Rate limiting          ← pluggable store (memory | Redis)
3. Database connection    ← cached; skippable for /api/health
4. Params / query / body  ← Zod; body-size and Content-Type enforced
5. Authentication         ← requireAuth() re-reads the user from MongoDB
6. Permission             ← RBAC matrix
7. Handler                ← receives validated input, actor, and `audit` context
     └── errors → normaliseError → single envelope + requestId
```

Stage 1 and the `audit` context in stage 7 were added *inside* the factory, so
all 28 routes — including the 22 written in Step 1 — gained both without being
edited. That is the payoff of having centralised transport concerns in Step 1.

---

## 4. Question paper domain

### 4.1 Model shape

```
QuestionPaper
├── identity      title, description, instructions
├── placement     category, subject, board, exam, year
├── config        mode (MANUAL|AUTO), durationMinutes
├── derived       totalMarks, totalQuestions        ← recomputed on every write
├── content       sections[] → questions[] { question ref, order, marks, note }
├── blueprint     generationSpec { chapters, quotas, seed }   (AUTO only)
├── lifecycle     status, publishedBy/At, archivedAt
├── versioning    version, versionHistory[] (bounded to 50)
└── lineage       clonedFrom, createdBy, updatedBy
```

**Reference plus snapshot.** A paper stores the question's `_id` *and* the marks
applied at build time. The reference keeps papers current when a question's text
is corrected; the snapshot keeps mark totals stable when a question's default
marks change later.

### 4.2 Lifecycle

```
        ┌──────────────── restore ───────────────┐
        ▼                                        │
     DRAFT ──── publish (paper:publish) ───▶ PUBLISHED
        │                                        │
        └──────── archive ──▶ ARCHIVED ◀── archive┘
                                 │
                                 └── restore ──▶ DRAFT
```

Restore returns to DRAFT rather than PUBLISHED, so re-publishing is a deliberate
act. Publishing requires a non-empty paper and the `paper:publish` permission.
Archived papers cannot be edited until restored.

### 4.3 Generation algorithm

```
spec ──▶ feasibility count ──▶ buildSlotPlan() ──▶ per-bucket $sample ──▶ backfill ──▶ warnings
         (1 countDocuments)     (pure, tested)      (≤ 40 buckets)        (≤ 2 passes)
```

Query cost is **O(buckets)**, not O(questions). A 200-question paper drawn from a
500,000-question bank issues the same handful of aggregations as a 10-question
one.

`buildSlotPlan` uses largest-remainder allocation to cross the two marginals, so
the plan always sums exactly to `totalQuestions`.

---

## 5. Export pipeline

```
PaperDoc (populated, answers gated at the projection)
   └── buildRenderedPaper(paper, variant)      ← the single decision point
         ├── renderPaperPdf()   pdf-lib + optional embedded TTF
         └── renderPaperDocx()  docx (natively Unicode)
```

Three properties this buys:

1. **Structural parity** between formats is guaranteed, not promised.
2. **Answer inclusion is decided once**, from an already-authorised variant.
3. **The on-screen paper preview reuses the same model**, so what a teacher sees
   is what exports.

Answers are excluded at the **database projection** for the student variant, so
an answer key is never loaded into memory for a caller who may not see it.

---

## 6. Security architecture

| Control | Mechanism | Layer |
|---|---|---|
| Authentication | Auth.js JWT; session re-read from MongoDB per request | `requireAuth` |
| Authorization | 25-permission matrix; ownership via `canActOnResource` | services |
| Route gate | middleware + per-handler re-check | both |
| **CSRF** | Origin / Referer / Sec-Fetch-Site on state-changing methods | `defineRoute` stage 1 |
| Answer protection | permission-gated projection, refuse-not-downgrade | service |
| Rate limiting | named policies, pluggable store | `defineRoute` stage 2 |
| Input validation | Zod, length caps, body-size cap, JSON-only | `defineRoute` stage 4 |
| **Audit trail** | append-only `AuditLog`, TTL 2 years | services |
| Secrets | typed env, redacting logger, no `console.log` | cross-cutting |
| Passwords | bcrypt 12, `select: false`, `tokenVersion` revocation | `lib/auth` |
| Reset tokens | SHA-256 at rest, 1 hour, single-use, atomic consume | service |

### Defence in depth, worked example

Exporting a teacher copy passes five independent checks: middleware session gate
→ route `paper:export` permission → service `paper:export-answers` check →
paper visibility check → database projection that omits `answer` unless
authorised. Any one failing denies the answer key.

---

## 7. Performance architecture

| Concern | Approach |
|---|---|
| Paper generation at scale | `$sample` per bucket; constant query count |
| Question resolution | one batched `$in` for a whole paper, never per-item |
| List endpoints | lean, projected, concurrent page-and-count, 100-row ceiling |
| Search | `$text` on the weighted index; no RegExp from user input |
| Paper reads | populate only what renders; answers only when authorised |
| Rate limiting | Redis store swaps in without touching a route |
| Audit writes | best-effort, never blocking, TTL-bounded growth |
| Bulk import | 500-per-request server cap, sequential client chunking |

New indexes are shaped to real queries (Equality → Sort → Range), consistent with
Step 1: no index was added speculatively, and none duplicates an existing one.

---

## 8. Directory map (Step 2 additions marked ★)

```
src/
├── middleware.ts
├── lib/
│   ├── api/          response · handler ★(hardened) · client · taxonomy-routes
│   ├── auth/         options · session · rbac ★(extended) · password
│   ├── config/       env ★(extended)
│   ├── db/
│   ├── email/ ★      types · index · templates/password-reset
│   ├── errors/
│   ├── export/ ★     paper-document · pdf · docx · fonts
│   ├── import/ ★     csv
│   ├── logger/
│   ├── rate-limit/   index ★ · memory-store · redis-store ★ · types
│   ├── repositories/ user · password-reset · taxonomy · question ★ · paper ★ · audit ★
│   ├── security/     regex · hash · origin ★
│   ├── services/     auth · password-reset ★ · taxonomy ★ · question ★ ·
│   │                 dashboard · paper ★ · paper-generator ★ ·
│   │                 paper-export ★ · audit ★
│   └── validation/   common · auth · taxonomy · question · paper ★
├── models/           …10 existing… · QuestionPaper ★ · AuditLog ★
├── types/            roles · question · api · next-auth · paper ★
├── components/
│   ├── ui/  auth/  dashboard/
│   ├── questions/ ★  QuestionForm · QuestionPreview · BulkImport
│   ├── review/ ★     ReviewQueue
│   └── papers/ ★     PaperList · PaperBuilder · PaperDetail
└── app/
    ├── (auth)/
    ├── dashboard/    …existing… · papers ★ · papers/new ★ · papers/[id] ★ ·
    │                 questions/new ★ · questions/[id]/edit ★ ·
    │                 questions/import ★ · review ★
    └── api/          …existing 22… · papers ★ · papers/[id] ★ ·
                      papers/[id]/actions ★ · papers/generate ★ ·
                      papers/[id]/export ★ · audit ★
```

---

## 9. Architecture decision records (Step 2)

| ADR | Decision | Rationale |
|---|---|---|
| ADR-11 | Papers store references + mark snapshots | Content corrections propagate; mark totals stay stable |
| ADR-12 | Generation via `$sample` buckets, not fetch-and-shuffle | Constant query cost regardless of bank size |
| ADR-13 | Report shortfalls; never pad or fail silently | A teacher can act on a named gap; they cannot act on a surprise |
| ADR-14 | `totalMarks` is a target, not a constraint | Forcing it means rejecting valid questions or rewriting marks |
| ADR-15 | One render model for PDF and DOCX | Makes structural parity a guarantee, not a promise |
| ADR-16 | Refuse unauthorised answer exports rather than downgrade | Never hand someone a file they believe contains answers |
| ADR-17 | Origin validation instead of a CSRF token | Same guarantee, no state, given the JSON-only body rule |
| ADR-18 | Audit is best-effort and append-only | Auditing must not break the operation it records, or be rewritable |
| ADR-19 | Redis behind a 4-method interface, not a driver dependency | Any client works; the project takes on no driver |
| ADR-20 | Hand-written CSV parser | 80 auditable lines beats a dependency tree on a security-sensitive path |
| ADR-21 | Optional embedded font for Bangla PDF, with an explicit degraded header | Honest failure beats a page of question marks |
| ADR-22 | Generalise `canActOnResource` rather than copy it for papers | Ownership rules stay in one place |

---

## 10. Known architectural debt

1. **No background job layer.** Generation and export run inline. Fine at the
   500-question cap; a queue is the next step if paper sizes or export volume
   grow.
2. **No multi-document transactions.** A replica set is not assumed. Paper writes
   are single-document and therefore atomic; bulk import is not, and reports
   per-item outcomes instead.
3. **Audit metadata is `Mixed`.** Convention-enforced, not schema-enforced.
4. **Section editing exists in the model and API but not the builder UI.**
5. **Question-level version history is absent** — only papers version.
6. **`Organization` remains unused.** Multi-tenancy is Step 3.
