# AutoQgen — Error Handling Audit

_Audit date: 2026-09-09 · Scope: full repository_

---

## 1. Executive Summary

### Current error-handling architecture

AutoQgen already has a **deliberate, layered error system**. It was not bolted on.

| Layer | Mechanism | File |
| --- | --- | --- |
| Error taxonomy | `AppError` base + `ValidationError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), `RateLimitError` (429), `PayloadTooLargeError` (413), `INTERNAL_ERROR` (500). `expose` flag marks a message client-safe. | `src/lib/errors/app-error.ts` |
| Error codes | 8 stable `ErrorCode` string literals (`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, `INTERNAL_ERROR`). | `src/lib/errors/app-error.ts` |
| Normalisation | `normaliseError()` maps Zod, Mongo duplicate-key (11000), Mongoose `ValidationError`, Mongoose `CastError`, and any unknown throw → an `AppError`. Unknown → generic 500. | `src/lib/errors/handler.ts` |
| Transport | `toErrorResponse()` logs (500s at `error`, 4xx at `info`), sets `Retry-After` for 429, and returns the envelope via `fail()`. | `src/lib/errors/handler.ts`, `src/lib/api/response.ts` |
| Route boundary | `defineRoute()` wraps **every** API route: origin check → rate-limit → DB connect → param/query/body Zod parse → auth → permission → handler, all inside one `try/catch` → `toErrorResponse(error, requestId)`. | `src/lib/api/handler.ts` |
| Response standard | `{ success: true, data, meta?, requestId }` or `{ success: false, error: { code, message, details? }, requestId }`. | `src/lib/api/response.ts`, `src/types/api.ts` |
| Client transport | `apiFetch()` **never throws** — always returns the discriminated envelope; network failure → `{ success:false, error:{ code:"INTERNAL_ERROR", message:"Network request failed. Check your connection." } }`. `fieldErrors()` flattens `details` → `{ field: message }`. | `src/lib/api/client.ts` |
| Logging | Structured, level-gated, **redacting** logger. Redacts `password/secret/token/cookie/session/apikey/mongodb_uri/answer/correctOptions/...` by key regex; caps string/array/depth; strips stack traces in production. | `src/lib/logger/index.ts` |
| React boundaries | `app/error.tsx` (root, full-screen), `app/dashboard/error.tsx` (in-shell `Alert` + retry), `app/not-found.tsx`. | `src/app/**` |
| Server pages | `requireAuth()` (+ Edge `middleware.ts` redirect for `/dashboard`,`/admin`), permission → `redirect()` or `resolveOrgPageAccess()` → access-denied render, resource fetch → `.catch(() => null); if (!x) notFound()`. | `src/app/**/page.tsx` |
| Client forms | Uniform pattern: `setBusy(true)` → `apiFetch` → `setBusy(false)` → `if (!result.success) { setError/setErrors + toast.error; return }` → success `toast.success`. Per-field `Alert`s + form-level `Alert tone="error"`. | 34 components |
| Multi-tenant | `org-session.ts` returns **`NotFoundError`, not `ForbiddenError`**, for a foreign org ("do not disclose existence to non-members"). `paperService.assertCanView()` uses the same convention. Every content query is `organizationId`-scoped, resolved server-side from the session — never from the client. | `src/lib/auth/org-session.ts`, services |
| Generation errors | The engine throws **actionable** `ValidationError`s (e.g. _"Only 8 eligible question(s) are available after your filters, but 20 were requested. Approve more questions, widen the chapter selection, or relax the previous-question / recent-paper restrictions."_) and emits `warnings[]` with codes (`POOL_TOO_SMALL`, `*_SHORTFALL`, `MARKS_MISMATCH`). UI has `friendlyWarnings()` / `friendlyError()` / `shortfallMessage()` translators. | `paper-generator.service.ts`, `PaperBuilder.tsx`, `GenerateTab.tsx` |

### What is already handled correctly

- **API envelope + error codes + normalisation** — production-grade, consistent, do **not** rewrite.
- **Internal-error suppression** — unknown throws become `"Something went wrong. Please try again."`; the real error is logged with a `requestId`. Raw `MongoServerError` strings never reach the client through `defineRoute`.
- **Logging redaction** — secrets, tokens, connection strings and answer keys are stripped; stack traces are dev-only.
- **Multi-tenant isolation via errors** — foreign-org access is `NotFoundError` everywhere; no error message interpolates another org's id/name/data. **Audited and found sound.**
- **Auth/RBAC** — `requireAuth` / `assertPermission` / `assertPermissionOrOrgMembership` throw typed errors that map cleanly to 401/403; pages redirect instead of erroring where that is the right UX.
- **Generation "impossible" cases** — the engine's hard-failure message already tells the user the count, the reason, and the fix.
- **Client forms** — consistent busy/error/toast pattern; `fieldErrors()` puts messages on the right field; forms do **not** reset on failure (state is preserved).
- **React boundaries** — root + dashboard `error.tsx`, `not-found.tsx`, `middleware` redirect-loop already fixed.

### What is missing / weak

1. **No `app/global-error.tsx`** — a render failure in the **root layout** (theme provider, session provider, fonts) shows a blank white page; `app/error.tsx` cannot catch layout-level errors.
2. **Export is a raw `<a href>` download** — a 403/404/500 from `/api/papers/[id]/export` renders as **raw JSON in the browser tab**. `X-Export-Degraded` (Bangla glyph substitution) is set by the route but **never read** by anything.
3. **Duplicate-key normalisation leaks internal field names** — `normaliseError()`'s 11000 branch copies `keyPattern` keys straight into `details`, so a race on a compound tenant index surfaces `details: [{ path: "organizationId", message: "Must be unique." }, ...]` — `organizationId` / `contentHash` are server-derived, never form fields.
4. **Avatar `GET` routes bypass `defineRoute`** — `src/app/api/users/{me,[id]}/avatar/route.ts` have a bare `catch {}` that returns `"Internal server error"` **with no logging** → a DB failure while serving avatars is invisible in the logs.
5. **Empty state is rendered together with the error state** — `PaperList`, `QuestionBrowser`, `ReviewQueue`, `TemplateList` show the error `Alert` **and** `EmptyState` ("No papers yet — create your first paper") simultaneously on a load failure, and offer no "Retry".
6. **Reference/taxonomy dropdown loads fail silently** — ~15 components do `if (result.success) setX(data)` for `/api/categories|subjects|chapters|...`; a failed load leaves an empty `<Select>` with **no feedback**, blocking the form.

### Major risks

- **P1** blank-page-on-layout-error (F1) — user has no path forward.
- **P1** raw JSON shown for a denied/failed export (F2) — looks broken, exposes `code`/`requestId` in the URL bar.
- **P1** internal field name (`organizationId`) surfaced in a user-facing `details[]` (F3 in §10) — minor information disclosure + can mis-target a form field error.
- **P1** unlogged swallowed 500s on the avatar route (F4) — operational blind spot.
- No **P0** findings: tenant isolation, auth, and internal-error suppression were specifically audited and are sound.

### Most important improvements (implemented — see §11)

1. Add `app/global-error.tsx`.
2. Harden `normaliseError()` duplicate-key branch: never surface server-derived keys.
3. Convert paper export to a `fetch`-based download that shows a toast on failure and a warning on `X-Export-Degraded`.
4. Log inside the avatar-route `catch`.
5. Split empty-state from error-state in the four list components; add "Retry".
6. Toast on failed form-option loads in `QuestionForm` / `PaperBuilder` / `RegeneratePanel`.

---

## 2. Error Handling Locations

> "Current Handling" = what actually happens to the error, not merely "there is a try/catch".

| Area | File | Function/Route | Possible Error | Current Handling | User Visible? | Recommended Handling |
| --- | --- | --- | --- | --- | --- | --- |
| Transport (all routes) | `src/lib/api/handler.ts` | `defineRoute` | any throw in handler / parse / auth | caught → `toErrorResponse` → envelope + log | Yes (message) | **Keep.** |
| Normalisation | `src/lib/errors/handler.ts` | `normaliseError` | Zod / Mongo 11000 / Mongoose validation / cast / unknown | mapped to `AppError`; unknown → generic 500 | Yes | **Keep**, but filter server-derived keys from 11000 `details` (F3). |
| Normalisation | `src/lib/errors/handler.ts` | `isMongooseValidationError` branch | e.g. `Path 'title' is longer than the maximum allowed length (200).` | passed through as a field message | Yes (raw mongoose text) | Low freq (Zod validates first). **Document, leave** — the length hint is useful. |
| Auth | `src/lib/auth/session.ts` | `requireAuth` / `assertPermission` | not logged in / no permission | throws `UnauthorizedError` / `ForbiddenError` → 401/403 envelope | Yes | **Keep.** |
| Auth (Edge) | `src/middleware.ts` | `middleware` | missing/invalid JWT on protected route | `redirect(/login?callbackUrl=…)` | Yes (redirect) | **Keep.** |
| Multi-tenant | `src/lib/auth/org-session.ts` | `requireOrgMembership` / `resolveOrgPageAccess` / `assertPermissionOrOrgMembership` | not a member / wrong org / insufficient org role | `NotFoundError` (not `Forbidden`) — deliberate non-disclosure | Yes ("… not found") | **Keep.** Sound. |
| Content scope | `src/lib/services/*.service.ts` | `requireContentOrganizationId` | user has no current org | `ValidationError("You must belong to an organization…")` | Yes | **Keep.** |
| Paper access | `src/lib/services/paper.service.ts` | `getById` / `assertCanView` | wrong org / not owner / not published | `NotFoundError("Paper")` | Yes | **Keep.** |
| Categories/Subjects/Chapters/Topics/Boards/Exams | `src/lib/services/taxonomy.service.ts` | `create`/`update`/`deactivate` | dup slug/name, bad parent, cross-org parent, missing | pre-checked → `ConflictError` / `ValidationError` / `NotFoundError` with resource-specific messages | Yes | **Keep.** Race → falls to `normaliseError` 11000 → generic (F3). |
| Taxonomy routes | `src/lib/api/taxonomy-routes.ts` | generic `taxonomyCollectionRoutes` / `taxonomyItemRoutes` | any of the above | via service + `defineRoute` | Yes | **Keep.** |
| Questions | `src/lib/services/question.service.ts` | `create`/`update`/`remove`/`transition`/`bulkReview` | dup `contentHash`, invalid answer-for-type, illegal status transition, cross-org taxonomy | typed errors; answer validation returns per-field `details` | Yes | **Keep.** Dup relies partly on unique index → F3. |
| Question import | `src/lib/services/question.service.ts` + `BulkImport.tsx` | CSV bulk import | malformed CSV, per-row validation, per-row dup, partial success | `repo.insertMany` `{ordered:false}` returns `{insertedCount, failures[{index,message}]}`; UI lists row failures | Yes (per-row) | **Keep** — good pattern. |
| Duplicate detection | `question.repo.ts` | `findByHashes` / unique index `{organizationId, chapter, contentHash}` | race between check and insert | DB rejects 11000 → `normaliseError` → generic | Yes (generic) | F3 — resource-aware message, drop internal `path`. |
| Similarity | `src/lib/services/paper-similarity.service.ts` | `getReview`/`keepBoth`/`replaceQuestion` | Gemini down/quota, malformed AI JSON, <2 questions, replacement exhaustion | `AiUnavailableError` (503) w/ specific messages; `<2` → `note`; exhaustion → `{accepted:false, reason}` (not an error) | Yes | **Keep** — well done. UI (`SimilarityReview.tsx`) shows `error` + "Try again". |
| Gemini client | `src/lib/ai/gemini.ts` | `generateJson` / `embedTexts` / `validateSimilarity` | no key, network, 429, 5xx, blocked prompt, empty/malformed reply | each → `AiUnavailableError` with a tailored message; upstream body logged server-only | Yes | **Keep.** |
| AI generate/import | `src/lib/services/ai-question.service.ts`, `AiGenerate.tsx` | generate / check-duplicates / import | AI failure, hierarchy invalid, per-candidate issues | typed errors; per-candidate `status: needs_review/duplicate` | Yes | **Keep.** |
| Question usage | `src/lib/services/question-usage.service.ts` | `syncForPaper` / `recordForPaper` | write failure during paper create/regenerate | **best-effort**: caught, `logger.error`, swallowed — must not fail the paper | No (by design) | **Keep** — correct trade-off, and it _is_ logged. |
| Manual paper create | `src/lib/services/paper.service.ts` | `create` | bad taxonomy, dup question in sections, question not APPROVED / wrong subject, cross-org | `resolveSections` throws `ValidationError` with specifics | Yes | **Keep.** |
| Auto generate + dry-run | `src/lib/services/paper-generator.service.ts` | `generate` / `availability` | 0 eligible, pool < needed, bad mandatory ids, dup difficulty/type rows | `ValidationError` — **actionable** (count + reason + fix); `warnings[]` for soft shortfalls | Yes | **Keep.** UI has `friendlyError`/`friendlyWarnings`/`shortfallMessage`. |
| Generate route | `src/app/api/papers/generate/route.ts` | `PUT` (dry-run) / `POST` (save) | above + `assertPermissionOrOrgMembership` | via service + `defineRoute`; `rateLimit: paperGenerate` | Yes | **Keep.** |
| Regeneration | `src/lib/services/paper.service.ts` | `regenerate` | non-AUTO paper, archived, not owner, above generation errors | `ValidationError` / `ConflictError` / `ForbiddenError` | Yes | **Keep.** `GenerateTab.regenerate` → `toast.error("Could not regenerate…", {description})`. |
| Distributions (difficulty/type/chapter) | `paper.schema.ts` `.superRefine` + generator | sums exceed total, dup rows | Zod `ValidationError` with `path` → field error; generator emits `*_SHORTFALL` warnings | Yes | **Keep.** |
| Previous / recent exclusion | generator §3 + `GenerateTab` | exclusion removes too many | `POOL_TOO_SMALL` / hard fail; `GenerateTab.shortfallMessage` explains "lower Exclude recent papers" | Yes | **Keep.** |
| PDF export | `src/lib/export/pdf.ts` + `paper-export.service.ts` | pdf-lib failure; missing Unicode font | render error → bubbles to `defineRoute` → 500 envelope; font missing → `degraded:true` → `X-Export-Degraded` header | **No** (link download shows raw JSON on 500; header unread) | F2 — `fetch`-based download, toast on failure, warn on degraded. |
| DOCX export | `src/lib/export/docx.ts` | `docx` lib failure | bubbles to `defineRoute` → 500 envelope | **No** (raw JSON) | F2. |
| Export route | `src/app/api/papers/[id]/export/route.ts` | `GET` | perm (`paper:export`), teacher-variant without `paper:export-answers`, not found, render | `ForbiddenError` / `NotFoundError` / 500 → envelope (but body is normally binary) | **No** (browser navigates to JSON) | F2. |
| Avatar serve | `src/app/api/users/{me,[id]}/avatar/route.ts` | `GET` | DB down, malformed stored image | bare `catch {}` → `"Internal server error"` string, **no log** | Partially (`<img>` breaks) | F4 — `logger.error` in catch; keep plain-text body (it feeds `<img>`). |
| Avatar upload | `ProfileSettings.tsx` → `PATCH /api/users/me` | client canvas resize → dataURL → `image` field | corrupt file, `FileReader` error, oversize | size/type pre-checked + toast; `PATCH` validates + `fieldErrors`; **no `reader.onerror`** | Mostly | P3 — add `reader.onerror` toast. Documented. |
| Users / roles | `src/lib/services/*` + `admin/*` | set org, change role, suspend | permission, self-demotion guard, missing user | typed errors; `admin/*` tables `toast.error` | Yes | **Keep.** |
| Org membership / invitations / teams | `invitation.service.ts`, `team.service.ts`, `organization-member.service.ts` | send/accept/reject/cancel invite, add/remove member, CRUD team | expired/used/foreign-email invite, dup member, last-owner guard, foreign team | typed errors; `NotFoundError` for foreign resources; UI `toast.error` | Yes | **Keep.** |
| Password reset | `auth.service.ts`, `password-reset.service.ts` | forgot / reset | unknown email (silent success — anti-enumeration), expired/used token | deliberate: forgot always 200; reset → `ValidationError` | Yes | **Keep** — intentional. |
| Register / login | `auth.service.ts`, NextAuth `authorize` | dup email, weak password, bad credentials | `ConflictError` / Zod / NextAuth returns null → generic "Invalid email or password" | Yes | **Keep.** |
| Client transport | `src/lib/api/client.ts` | `apiFetch` | network down, non-JSON body, timeout | never throws → envelope with `INTERNAL_ERROR` + friendly message | Yes (via caller toast) | **Keep.** No 429 `Retry-After` surfacing — P3, documented. |
| Root render | `src/app/error.tsx` | boundary | any client render throw below root layout | full-screen "Something went wrong" + digest + Try again / Dashboard | Yes | **Keep.** |
| Layout render | _(none)_ | — | throw in `app/layout.tsx` / providers | **blank white page** | Yes (blank) | **F1 — add `app/global-error.tsx`.** |
| Dashboard render | `src/app/dashboard/error.tsx` | boundary | any throw below `/dashboard` layout | in-shell `Alert` + Try again | Yes | **Keep.** |
| List pages | `PaperList`, `QuestionBrowser`, `ReviewQueue`, `TemplateList` | list fetch | load failed | `setError` → `Alert` **and** `EmptyState` shown together; no Retry | Yes (confusing) | **F5 — hide empty state when errored; add Retry.** |
| Form option loads | `QuestionForm`, `PaperBuilder`, `RegeneratePanel` (+ ~12 more) | mount `Promise.all([...taxonomy])` | one/all fail | `if (result.success) setX` — **silently ignored**; empty `<Select>` | **No** | **F6 — toast on failed load in the 3 blocking forms; document the rest.** |

---

## 3. Error Categories

### A. Validation Errors
Missing required field, invalid question format / answer-for-type, invalid count (`< 1`, `> 500`), invalid difficulty/type enum, distribution sums exceed total, duplicate distribution rows, malformed ObjectId, oversized text/payload.
→ `ValidationError` (400) with `details: FieldIssue[]`. Client: `fieldErrors()` → per-field `Alert` + form `Alert`. **Handled.**

### B. Authentication Errors
Not logged in, JWT without `uid`, suspended-after-mint, expired session.
→ `UnauthorizedError` (401) for API; `middleware` / `requireAuth` `redirect(/login)` for pages. **Handled.**

### C. Authorization Errors
Missing platform permission, missing org permission, wrong org role, non-owner editing an owned resource.
→ `ForbiddenError` (403) for genuine "you're a member but can't do this"; **`NotFoundError` (404) for "not your org / not visible"** (non-disclosure). Pages `redirect()` or render access-denied. **Handled — the Forbidden-vs-NotFound split is intentional and correct.**

### D. Resource Errors
Question / Subject / Chapter / Topic / Board / Exam / Paper / Template / Organization / User / Invitation / Team not found (or not visible to this org).
→ `NotFoundError("<Resource>")` (404). Pages: `.catch(() => null); if (!x) notFound()`. **Handled.**

### E. Duplicate Errors
Duplicate question (`contentHash`), duplicate slug/name (category/subject/board/exam), duplicate template name, duplicate org member, duplicate invitation.
→ Services pre-check → `ConflictError` (409) with resource-specific message. **Race path falls to `normaliseError` 11000 → generic message + leaks index keys → F3.**

### F. Database Errors
Connection failure, Mongoose schema validation, duplicate key (11000), cast error, query failure.
→ `connectDB` throw → `defineRoute` catch → generic 500 + log (connection string redacted). 11000 / validation / cast → mapped in `normaliseError`. **Handled; F3 tightens 11000.** Transactions: the codebase deliberately does **not** use multi-doc transactions (single-node dev DB; usage-sync is best-effort + logged) — documented as an accepted design constraint, not a bug.

### G. Generation Errors
0 eligible questions, `eligible < requested`, mandatory id not eligible, distribution impossible, exclusion removed too many, unexpected engine throw.
→ Engine `ValidationError` messages already carry **count + reason + fix**. Soft shortfalls → `warnings[]` shown as advisories. UI translators: `friendlyError` / `friendlyWarnings` / `shortfallMessage`. **Handled — this is the strongest area.** (Only polish: `friendlyError` passes non-matching messages through verbatim, which is fine because backend messages are already user-safe.)

### H. File / Export Errors
PDF render failure, DOCX render failure, Bangla font missing (degraded).
→ Service/route produce a correct envelope on failure and a `degraded` flag on success. **UI cannot react** because the download is a plain link → **F2**. Cloudinary: **not used in this project** (no dependency, no code) — N/A.

### I. Network / API Errors
`apiFetch` → `{ INTERNAL_ERROR, "Network request failed. Check your connection." }`. Non-JSON body → `"Unexpected response from the server."`. **Handled** (caller shows a toast). Rate limit (429) → envelope message "Too many requests. Please try again later." shown; `Retry-After` seconds not surfaced (P3).

### J. Unexpected / Internal Errors
Any unmapped throw → `AppError("INTERNAL_ERROR", 500, "Something went wrong. Please try again.")`; real error `logger.error("Unhandled server error", { requestId, error })`; client shows the generic message. **Handled** at the API boundary. **Gap: root-layout render throw → blank page (F1).**

### K. AI / External-Dependency Errors _(project-specific)_
Gemini key missing, quota, network, 5xx, blocked prompt, malformed/empty reply.
→ `AiUnavailableError` (503) with a tailored message per cause; upstream body logged server-only; UI shows `error` + retry. **Handled.**

---

## 4. User-Facing vs Internal Errors

| Error | Category | Disposition | User sees | Server logs |
| --- | --- | --- | --- | --- |
| Zod / Mongoose validation | A | **User-facing** | the field message(s) | 4xx `info` line (code+status only) |
| Not logged in / no permission | B/C | **User-facing** | "Authentication is required." / "You do not have permission…" / redirect | 4xx `info` line |
| Foreign-org access | C/D | **User-facing (as NotFound)** | "Paper not found." — **never** the other org's data | 4xx `info` line |
| Resource missing | D | **User-facing** | "Question not found." | 4xx `info` line |
| Duplicate (pre-checked) | E | **User-facing** | "A subject with this slug already exists." | 4xx `info` line |
| Duplicate (DB race, 11000) | E/F | **User-facing message, internal keys hidden** | "A record with these values already exists." — **no `organizationId` / `contentHash` in `details`** (after F3) | 4xx `info` line + `keyPattern` fields at `debug` |
| Generation impossible | G | **User-facing (actionable)** | count + reason + fix | 4xx `info` line |
| PDF/DOCX render failure | H | **User-facing (generic) + internal detail** | "Could not generate the file. Please try again." (toast, after F2) | 500 `error` line with the pdf-lib/docx throw |
| Bangla font missing | H | **User-facing (warning)** | "Some Bangla characters were substituted in the file." (toast, after F2) | — |
| Mongo connection down | F | **Internal → generic** | "Something went wrong. Please try again." | 500 `error` line; connection string **redacted** |
| Unknown exception / programming error | J | **Internal → generic** | "Something went wrong. Please try again." | 500 `error` line + full error (stack dev-only) |
| Avatar serve failure | F/J | **Internal → generic** | broken `<img>` | **currently NOT logged → F4 adds `logger.error`** |
| Gemini unavailable | K | **User-facing (specific but non-technical)** | "The AI service is busy right now. Try again in a moment." | 500/`error` with upstream status+body slice |

**Never surfaced to the user:** stack traces, `MongoServerError`/`E11000` strings, index names, collection names, connection strings, Gemini upstream response bodies, `organizationId`/`contentHash`/`_id` field names, another org's ids or names.

---

## 5. User Message Strategy

Already largely followed. Canonical mapping (UI mechanisms are the project's existing ones — no new library):

| Error type | User message | UI method |
| --- | --- | --- |
| Field validation | the specific fix ("Title is required.", "Count must be between 1 and 500.") | inline `Field` error + form `Alert tone="error"` |
| Form-level validation | short summary | `Alert tone="error"` at top of form |
| Permission (API action) | "You do not have permission to perform this action." | `toast.error` |
| Permission (page) | redirect to a safe page, or an in-page access-denied card | `redirect()` / render |
| Not found (page) | dedicated 404 page | `notFound()` |
| Not found (action) | "That item could not be found. It may have been deleted." | `toast.error` |
| Duplicate | "A <resource> with this <field> already exists." | `toast.error` + field `Alert` |
| Generation impossible | "Only N questions match your filters, but M were requested. Reduce the count or adjust the filters." | in-flow `Alert` + `toast.error` with `description` |
| Generation soft shortfall | advisory: "Some preferences could not be fully matched; the closest questions were used." | in-flow advisory list (not an error) |
| File / export failure | "Could not generate the file. Please try again." | `toast.error` |
| Export degraded | "Some Bangla characters were substituted in the exported file." | `toast.warning` |
| AI unavailable | "The AI service is busy right now. Try again in a moment." | `error` state + `toast.error` |
| Network | "Unable to connect. Please check your connection and try again." | `toast.error` |
| Rate limited | "Too many requests. Please wait a minute and try again." | `toast.error` |
| Internal / unknown | "Something went wrong. Please try again." (+ `Reference: <digest/requestId>` where available) | `toast.error` / `error.tsx` |
| List load failed | "Could not load <items>." + **Retry** button; **no empty state** | `Alert tone="error"` + `Button` |

---

## 6. Error Response Standard

**No change needed — the existing standard is correct and used everywhere.**

```jsonc
// success
{ "success": true, "data": <T>, "meta"?: <PaginationMeta>, "requestId": "uuid" }
// failure
{ "success": false, "error": { "code": "<ErrorCode>", "message": "<safe text>", "details"?: [{ "path": "field", "message": "..." }] }, "requestId": "uuid" }
```

Produced by `ok()` / `fail()` (`src/lib/api/response.ts`), consumed by `apiFetch()` + `fieldErrors()` (`src/lib/api/client.ts`), typed by `ApiResult<T>` (`src/types/api.ts`). Do **not** introduce a parallel structure.

---

## 7. Error Code System

**Already present and sufficient.** The 8 `ErrorCode` values in `src/lib/errors/app-error.ts` cover every case the client needs to branch on. The client today branches on `success` + `message`, not on `code`, and that is adequate for this app's UI.

**Decision: do not add resource-specific codes** (`QUESTION_NOT_FOUND`, `INSUFFICIENT_QUESTIONS`, `GENERATION_FAILED`, `FILE_UPLOAD_FAILED`, `DATABASE_ERROR`, …). Justification:
- The UI never needs to distinguish "question not found" from "paper not found" programmatically — the human-readable `message` already does that.
- `INSUFFICIENT_QUESTIONS` / generation failures are `VALIDATION_ERROR` with an actionable message; a code adds nothing the message doesn't.
- Adding ~10 codes would be an unused abstraction, against the constraints.

`AiUnavailableError` already exists as a dedicated `AppError` subclass (status 503, code `INTERNAL_ERROR`) — that is the one place a distinct concept earned its own class, and it is enough.

---

## 8. Error Logging

**Current state — good:**
- Single structured `logger` (`src/lib/logger/index.ts`); `console.error` for `error`, `console.warn` otherwise; JSON lines.
- **Key-based redaction**: `password`, `secret`, `token`, `authorization`, `cookie`, `session`, `apikey`, `mongodb_uri`, `connectionstring`, `credential`, `answer`, `correctOptions`, `booleanAnswer` → `"[redacted]"`.
- String cap 512, array cap 20, depth cap 4 → a full DB result can't be dumped.
- `Error` values serialised to `{ name, message, stack }`; **`stack` omitted when `NODE_ENV === "production"`**.
- Level-gated by `LOG_LEVEL`.
- 500s logged at `error` with `{ requestId, error }`; 4xx logged at `info` with `{ requestId, code, status }` only (no body).

**What should be logged:** unexpected 500s (full error + requestId), best-effort failures that were swallowed (usage-sync — already done), AI upstream failures (status + truncated body — already done).
**What must NOT reach the user:** stack traces, DB/connection details, index/collection names, tokens/secrets, Gemini upstream bodies, another org's data. — all currently satisfied through `defineRoute` + `redact()`.

**Gaps fixed:**
- **F4** — the avatar `GET` routes' `catch {}` logs nothing. Add `logger.error("Avatar route failed", { userId, error })` (the `userId` is the acting user's own id; safe).

**Gaps documented (not changed):**
- `app/error.tsx` / `app/global-error.tsx` use `console.error(digest)` on the client — correct (the server logger is server-only; only the non-sensitive `digest`/`name` is logged).
- `redact()` is **key-name** based, not value-scanning: a secret placed under an innocuously-named key (e.g. `note`) would not be caught. Low risk given call sites pass ids/counts/enums; noted for future reviewers.

---

## 9. UI Error Handling Audit

| Symptom | Where | Status | Fix |
| --- | --- | --- | --- |
| Blank white page on failure | root layout / providers throw | **Present** | **F1** `app/global-error.tsx` |
| Raw JSON shown in the browser | click "PDF (teacher)" without permission, or any export 5xx (`PaperDetail.tsx` `<a href>`) | **Present** | **F2** `fetch`-based download + toast |
| API failure not displayed | `X-Export-Degraded` never read; export link errors invisible | **Present** | **F2** |
| Empty state confused with error state | `PaperList`, `QuestionBrowser`, `ReviewQueue`, `TemplateList` — error `Alert` + "No … yet" `EmptyState` shown together, no Retry | **Present** | **F5** hide `EmptyState` when errored; add Retry |
| Button/select does nothing, no feedback | `QuestionForm` / `PaperBuilder` / `RegeneratePanel` (+ ~12 others): a failed `/api/categories\|subjects\|…` load leaves an empty `<Select>` silently | **Present** | **F6** toast on failed option load (3 blocking forms); rest documented |
| Error only in console | avatar `GET` route `catch {}` | **Present** | **F4** |
| Error only in console | `app/error.tsx` `console.error` | **By design** (client boundary) | keep |
| Loading state never stops | forms call `setBusy(false)` right after `apiFetch` (which never throws); code in between is pure | **Not present** | — |
| Form resets after failure | all forms preserve state on `!success` and only clear on success | **Not present** | — |
| Modal stays open incorrectly | admin/org modals close only on success; keep open + show error on failure | **Not present** | — |
| Toast misleading | messages come from typed `AppError`s (accurate) or the generic fallback | **Not present** | — |
| Page crashes | `error.tsx` (root + dashboard) catches client render throws | **Covered** except layout level (F1) |
| No feedback on success | every mutation `toast.success` (+ `toast.flash` across redirects) | **Not present** | — |
| Double-submit | mutating buttons `disabled={busy}` / `loading={busy}` | **Mostly covered**; spot-checked PaperDetail/PaperList/forms — OK |
| DB blip shows "Page not found" | `admin/organizations/[id]/page.tsx` and `.catch(() => null)` pages coerce any fetch error to `notFound()` | **Present (minor)** | **Document** — acceptable; a transient error is rare and Retry is one refresh away |
| Corrupt image file, nothing happens | `ProfileSettings` has no `reader.onerror` | **Present (minor)** | **Document** — size/type are pre-checked; P3 |

---

## 10. Priority

### P0 — Critical (data / security / tenant isolation / serious failure)
**None.** Tenant isolation (foreign-org → `NotFoundError`, every query `organizationId`-scoped from the session), auth/RBAC, and internal-error suppression were specifically audited and are sound. No error message discloses another organization's data.

### P1 — High (major user-facing failure or operational blind spot)
- **F1** — no `app/global-error.tsx`: root-layout render failure = blank page, no recovery path.
- **F2** — paper export is a raw `<a href>`: a denied/failed export renders as raw JSON in the browser tab; `X-Export-Degraded` is unread.
- **F3** — `normaliseError()` 11000 branch surfaces server-derived index keys (`organizationId`, `contentHash`, …) as user-facing `details[].path` and a non-specific message.
- **F4** — avatar `GET` routes swallow 500s with **no logging**.

### P2 — Medium (poor / inconsistent UX)
- **F5** — list components render the error `Alert` **and** the `EmptyState` together on load failure; no "Retry".
- **F6** — form-option (taxonomy) loads fail silently, leaving empty dropdowns with no feedback.

### P3 — Low (minor)
- `apiFetch` does not surface `Retry-After` seconds for 429 (message is still shown).
- `.catch(() => null)` / `admin/organizations/[id]` coerce transient fetch errors to `notFound()`.
- `ProfileSettings` has no `FileReader.onerror` handler.
- No `app/dashboard/not-found.tsx` (a `notFound()` under `/dashboard` uses the full-screen root 404 instead of an in-shell one).
- `redact()` is key-name based, not value-scanning.

---

## 11. Implementation Summary

_(Filled in after Phase 2 — see below.)_
