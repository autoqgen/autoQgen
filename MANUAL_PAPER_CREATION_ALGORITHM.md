# Manual Question Paper Creation — Current Algorithm

This document describes **only** the Manual Question Paper creation flow as it
exists in the code today. It is not a design proposal. "Manual" here means a
paper whose questions are chosen explicitly by the caller (`mode: "MANUAL"`), as
opposed to Smart / Auto generation (`mode: "AUTO"`, a separate flow through
`/api/papers/generate` and `paperGeneratorService`).

---

## 1. Where the flow lives

| Layer | Location |
|---|---|
| HTTP endpoint | `POST /api/papers` — `src/app/api/papers/route.ts` |
| Request validation | `createPaperSchema` — `src/lib/validation/paper.schema.ts` |
| Business logic | `paperService.create()` — `src/lib/services/paper.service.ts` |
| Question validation | `resolveSections()` — same file |
| Taxonomy check | `assertTaxonomy()` — same file |
| Question lookup | `questionRepository.findForPaper()` — `src/lib/repositories/question.repo.ts` |
| Persistence | `paperRepository.create()` → `QuestionPaper.create()` — `src/lib/repositories/paper.repo.ts`, `src/models/QuestionPaper.ts` |
| Usage bookkeeping | `questionUsageService.syncForPaper()` — `src/lib/services/question-usage.service.ts` |
| Audit | `auditService.record()` — `src/lib/services/audit.service.ts` |

**There is currently no dedicated Manual Paper Builder screen.** The
`/dashboard/papers/new` page (`src/app/dashboard/papers/new/page.tsx`) renders
`PaperBuilder`, which is the Smart / Auto generator and posts to
`/api/papers/generate`. No component in `src/components/` calls `POST /api/papers`.
Manual creation is reachable through the API only. A client that used it would
typically browse questions with `GET /api/questions` first, then submit the
chosen ids — but that browsing step is not part of `paperService.create()`.

---

## 2. Request the caller sends

Body validated by `createPaperSchema`:

```
{
  organizationId?  // super_admin cross-tenant override only; ignored for everyone else
  title            // required, 1–200 chars
  description?      // 0–2000
  instructions?    // 0–5000
  category         // required, 24-char ObjectId
  subject          // required, 24-char ObjectId
  board?           // optional ObjectId or null
  exam?            // optional ObjectId or null
  year?            // optional integer 1900–2200, default null
  durationMinutes? // optional integer 0–1440, default null
  sections?        // optional, default []
      [{
        title?, instructions?,
        order,                 // integer
        questions: [
          {
            question,          // required ObjectId
            order,             // integer
            marks?,            // optional 0–1000 override
            note?              // optional 0–500
          }
        ]
      }]
}
```

Structural limits from the schema: `MAX_SECTIONS = 20`,
`MAX_QUESTIONS_PER_SECTION = 200`, `MAX_QUESTIONS_PER_PAPER = 500`.

Fields the schema deliberately does **not** accept (all set by the server):
`createdBy`, `mode`, `status`, `totalMarks`, `totalQuestions`, `designConfig`,
`updatedBy`, `publishedBy`.

---

## 3. Step-by-step algorithm

### Step 0 — Route pipeline (`defineRoute` in `src/lib/api/handler.ts`)

For `POST /api/papers`, before any business logic:

1. **Origin check** — `assertTrustedOrigin()` (state-changing request must come
   from an allowed origin).
2. **Rate limit** — `enforceRateLimit("paperCreate", ip)`. Policy:
   `paperCreate = 60 requests / 60 minutes` per client
   (`src/lib/rate-limit/index.ts`).
3. **DB connection** — `connectDB()`.
4. **Body parsing** — parsed against `createPaperSchema`; a shape error returns
   `400 VALIDATION_ERROR` and the handler never runs.
5. **Authentication** — `requireAuth()` (must be a logged-in, active user).
   No static route-level permission is attached; the permission is checked
   inside the service (Step 2).

### Step 1 — `paperService.create(input, actor, context)` begins

### Step 2 — Permission check

```
await assertPermissionOrOrgMembership(actor, "paper:create", "paper:create")
```

Passes if **either**:

- the actor's global role holds `paper:create` (`content_writer` and above —
  see `ROLE_PERMISSIONS` in `src/lib/auth/rbac.ts`), **or**
- the actor has an **active** `OrganizationMember` row in their current
  organization whose org-role holds the `paper:create` org-permission
  (`src/lib/auth/org-rbac.ts` — every ordinary member role has it).

Otherwise `403 FORBIDDEN`.

### Step 3 — Resolve the organization (tenant)

```
const organizationId = await requireContentOrganizationId(actor, input.organizationId)
```

(`src/lib/auth/org-session.ts`)

- **Non-super-admin:** `input.organizationId` is ignored. The org is
  `actor.organizationId` **only if** the actor has an active membership there;
  otherwise it falls back to the actor's oldest active `OrganizationMember`
  organization. If there is none → `400 VALIDATION_ERROR`
  ("You must belong to an organization…").
- **super_admin:** may pass `input.organizationId` as an explicit target
  (must be an existing `Organization`); otherwise their `user.organization`
  pointer is used.

Every subsequent lookup and the saved paper are pinned to this `organizationId`.

### Step 4 — Taxonomy check (`assertTaxonomy(input, organizationId)`)

Only the **subject** is verified:

1. `taxonomyRepository.findById("subject", input.subject, organizationId)` — the
   subject must exist **in this organization**. A subject from another tenant is
   not found → `400` ("The selected subject does not exist.").
2. The subject's `category` must equal `input.category` → otherwise `400`
   ("…does not belong to the selected category.").

`board`, `exam`, `year`, and any chapter/topic are **not** validated here — they
are accepted as-is (or null).

### Step 5 — Resolve and validate the sections (`resolveSections`)

Input: `input.sections` (may be `[]`), the paper's `subject`, the resolved
`organizationId`.

**5a. In-paper de-duplication and count**
Walk every section in order; collect each `question` id into a `Set`. If an id is
seen twice **anywhere in the paper** → collect a field issue
("This question already appears in the paper."). If the total id count exceeds
`MAX_QUESTIONS_PER_PAPER` (500) → issue. Any issue here → throw
`ValidationError` ("The paper contains invalid question selections.") with the
field paths.

**5b. One batched question lookup**

```
const docs = await questionRepository.findForPaper(allIds, organizationId)
```

This is a single query: `Question.find({ _id: { $in: allIds }, organizationId })`
projecting `_id, type, difficulty, marks, status, isActive, subject, chapter,
organizationId`. Because `organizationId` is in the filter, a question belonging
to another tenant simply is not returned (treated as "no longer exists").
**There is no browsing / eligible-pool query — only these exact ids are fetched.**

**5c. Per-question eligibility rules**
For each submitted question, build the stored entry and check:

| Rule | Failure message |
|---|---|
| Doc was returned **and** `doc.isActive === true` | "This question no longer exists." |
| `doc.status === "APPROVED"` | "Only approved questions can be added to a paper." |
| `doc.subject === paper.subject` | "This question belongs to a different subject." |

No other conditions are applied: **no** filter on difficulty, question type,
chapter, topic, board, exam, year, language, previously-used status, or content
hash. If any check fails for any question → throw `ValidationError` with all the
field paths.

**5d. Marks snapshot**
Stored `marks` for each entry = `entry.marks` (client override) if given,
otherwise `doc.marks`, otherwise `1`. This value is frozen on the paper even if
the question's own marks change later.

**5e. Canonical ordering (no randomization)**
The normalised sections are sorted by `order`, then re-indexed `0,1,2,…`.
Within each section the questions are sorted by their `order`, then re-indexed
`0,1,2,…`. This is a deterministic canonicalisation of the caller-supplied
order — questions are **never** shuffled or re-selected.

Output: `NormalisedSection[]` with
`{ title, instructions, order, questions: [{ question: ObjectId, order, marks, note }] }`.

### Step 6 — Compute totals (`computeTotals(sections)`)

`totalQuestions` = count of question entries across all sections.
`totalMarks` = sum of the snapshotted `marks`. Always recomputed server-side;
never taken from the client.

### Step 7 — Persist the paper (`paperRepository.create`)

```
QuestionPaper.create({
  ...client fields (title, description, instructions, category, subject,
                     board, exam, year, durationMinutes),
  organizationId,          // resolved in Step 3
  sections,                // normalised (Step 5)
  totalMarks, totalQuestions,   // Step 6
  mode:   "MANUAL",
  status: "DRAFT",
  createdBy: actor.objectId,
})
```

Schema defaults fill the rest: `designConfig: null`, `updatedBy: null`,
`publishedBy: null`, `publishedAt: null`, `archivedAt: null`, `clonedFrom: null`,
`isActive: true`, `generationSpec: null`, plus `createdAt` / `updatedAt`
timestamps. There is **no** version or version-history field.

### Step 8 — Record question usage (`questionUsageService.syncForPaper`) — best effort

Wrapped in `try/catch`; a failure here is logged but does **not** fail paper
creation.

```
syncForPaper({
  organizationId,
  questionPaperId: paper._id,
  questionIds: questionIdsOf(sections),   // distinct question ObjectIds in the paper
  paperType: "OTHER",
  createdBy: actor.objectId,
})
```

`syncForPaper`:

1. **Upsert** one `QuestionUsage` row per question via
   `questionUsageRepository.recordMany()`. This is a `bulkWrite` with
   `updateOne … $setOnInsert … upsert: true`, keyed on the unique index
   `{ questionId, questionPaperId }` (`src/models/QuestionUsage.ts`). Re-recording
   the same pair is a no-op, so it is idempotent. Each row stores
   `organizationId`, `paperType: "OTHER"`, `usedAt` (now), `createdBy`.
2. **Prune** — `questionUsageRepository.deleteForPaperExcept(organizationId,
   paperId, questionIds)` deletes any `QuestionUsage` rows for *this* paper id
   whose question is not in the current set. On a fresh create there are none.

This records that these questions have now been *used*; it does **not** read or
enforce anything about previously-used questions during creation.

### Step 9 — Audit

```
auditService.record({
  action: "paper.create",
  resourceType: "paper",
  resourceId: paper._id,
  metadata: { title, questions: totalQuestions },
}, context)
```

Failures are swallowed by `auditService` and never break the request.

### Step 10 — Response

`paperService.create()` returns the created paper document. The route responds
`201 Created` with the paper as the body (`ok(paper, { status: 201 })`).

---

## 4. What the manual flow does **not** do (verified absent in the code)

- **No question fetching / eligible-pool building.** The server only looks up
  the exact ids the caller submitted (`findForPaper`); it never queries a
  candidate set.
- **No distribution logic.** No difficulty quotas, no question-type quotas, no
  per-chapter or per-topic distribution. Those exist only in
  `paperGeneratorService` (the Auto flow).
- **No randomization.** Sections and questions are kept in the caller's order
  (only canonically re-indexed). There is no random selection, order shuffle,
  or option shuffle on manual create.
- **No previously-used / recent-paper checking.** `QuestionUsage`,
  `previousQuestions` mode/percent, `excludeRecentPapers` are inputs to
  `paperGeneratorService` only. Manual create *writes* usage rows afterward
  (Step 8) but never reads them to include/exclude questions.
- **No content-hash / text duplicate detection.** The `contentHash` uniqueness
  on the `Question` model prevents duplicate *questions* from being created; it
  plays no part in adding questions to a paper. The only duplicate check here is
  "the same question id twice in one paper" (Step 5a).
- **No board / exam / year / chapter / topic validation.** Only `subject`
  (and its parent `category`) is checked.
- **No difficulty or language rules.** Any approved, active, same-subject
  question is accepted regardless of difficulty or language.
- **No design configuration.** `designConfig` is left `null`; the Paper View
  merges display defaults later (`DEFAULT_PAPER_DESIGN`), separate from creation.

---

## 5. Resulting stored document (manual paper)

```
QuestionPaper {
  organizationId,                 // tenant, resolved server-side
  title, description, instructions,
  category, subject, board, exam, year,
  durationMinutes,
  mode: "MANUAL",
  status: "DRAFT",                // always starts as a draft
  totalMarks, totalQuestions,     // server-computed snapshots
  sections: [
    { title, instructions, order, questions: [
      { question: <ObjectId>, order, marks: <snapshot>, note }
    ] }
  ],
  generationSpec: null,           // only Auto papers have one
  designConfig: null,
  createdBy: <actor>,
  updatedBy: null, publishedBy: null, publishedAt: null, archivedAt: null,
  clonedFrom: null,
  isActive: true,
  createdAt, updatedAt
}
```

Plus one `QuestionUsage` row per distinct question
(`{ questionId, questionPaperId, organizationId, paperType: "OTHER", usedAt,
createdBy }`), created best-effort in Step 8.

---

## 6. Tenant isolation summary

The paper's organization is resolved from the **actor's active membership**
(Step 3), never trusted from the request body (except a `super_admin` override).
Every subsequent operation is scoped to that id:

- `assertTaxonomy` — subject lookup is org-scoped.
- `questionRepository.findForPaper(ids, organizationId)` — a question from
  another organization is not returned and is rejected as "no longer exists".
- `paperRepository.create` stores `organizationId` on the paper.
- `questionUsageService.syncForPaper` writes `organizationId` on every usage row
  and deletes only within that org + paper id.

---

## 7. Failure points (all return HTTP 4xx, nothing is saved)

| When | Result |
|---|---|
| Untrusted origin / rate limit exceeded | `403` / `429` (before the service runs) |
| Body fails `createPaperSchema` | `400 VALIDATION_ERROR` |
| Missing `paper:create` capability | `403 FORBIDDEN` |
| Actor has no organization | `400 VALIDATION_ERROR` |
| Subject not in org / wrong category | `400 VALIDATION_ERROR` |
| Same question id twice, or > 500 questions | `400 VALIDATION_ERROR` |
| A question is missing / inactive / not APPROVED / different subject | `400 VALIDATION_ERROR` |

Usage-recording (Step 8) and audit (Step 9) failures are logged only and do
**not** roll back or fail the created paper.
