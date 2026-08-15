# IMPLEMENTATION_SUMMARY.md

**Project:** AutoQgen
**Phase:** Step 2 — Auto Question Paper Generation Platform
**Date:** 2026-08-09

---

## What changed, in one paragraph

AutoQgen was a question bank. It is now a paper generation platform. A teacher
can describe a blueprint — subject, chapters, question count, difficulty mix,
type mix — and get a paper assembled from approved questions in one request, or
build one by hand from a filtered search. Papers move through draft → published →
archived with version history, clone and restore. Both export to PDF and DOCX in
a student copy and a teacher copy with the answer key. Alongside that: authoring
and review UI for questions, a chunked CSV/JSON bulk importer, real password
reset emails, CSRF origin validation, an append-only audit trail, and a rate
limiter that can be moved to Redis without touching a route.

---

## Delivery against the brief

| Feature | Delivered |
|---|---|
| 1 — Question Paper Builder | Manual and auto modes. Manual: search, 10-field filtering, select, remove, reorder, preview, save. Auto: blueprint → dry run → save, honouring chapters, marks, difficulty and type distributions with no duplicates, approved questions only, RBAC enforced. |
| 2 — Paper management | Create, edit, delete (soft), clone, archive, publish, restore. Draft/Published/Archived with a transition map. Version counter plus a bounded 50-entry history recording who changed what and when. |
| 3 — Question create & edit UI | One form covering all ten types with type-driven answer controls, live preview, field-level server error mapping, loading and success states. |
| 4 — Review workflow UI | Queue with status filtering. Authors submit for review; reviewers approve or reject with a note. Controls hidden without the permission and refused server-side regardless. |
| 5 — Bulk import UI | CSV and JSON upload, downloadable template, local parse warnings, 10-row preview, automatic 500-per-request chunking with progress, and a per-row error report mapped back to original file lines. |
| 6 — PDF export | Student and teacher variants. Header block, running footer, page numbering, per-section marks, mark distribution table. |
| 7 — DOCX export | Same variants, built from the same render model, so structure cannot drift. Natively Unicode. |
| 8 — Password reset email | HTML and plain-text templates, secure single-use link, stated expiry, plus a password-changed notification. Pluggable transport. |
| 9 — Security hardening | Origin/Referer/Sec-Fetch-Site CSRF validation on every state-changing request, an append-only `AuditLog` with TTL wired into every mutation, and validation extended to the new surfaces. |
| 10 — Performance | `$sample` bucket generation (constant query count), batched question resolution, new query-shaped indexes, `RedisRateLimitStore` behind the existing interface. |

---

## How Step 1 conventions were reused, not re-invented

The brief required reusing existing patterns. Concretely:

| Step 1 asset | How Step 2 uses it |
|---|---|
| `defineRoute` | All 7 new routes are built with it. Origin validation and the audit context were added *inside* it, so every existing route gained both without being edited. |
| `AppError` taxonomy | Paper and export services throw `ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError`. No new error handling. |
| API envelope | Every new JSON route returns `{ success, data, meta?, requestId }`. The export route is the single, documented exception — it streams a binary. |
| Zod validation | `paper.schema.ts` composes the existing `objectIdSchema`, `paginationQuerySchema`, `searchTermSchema`, `yearSchema`, `shortTextSchema`. |
| Pagination | Paper lists use the same `paginationQuerySchema` and the same 100 ceiling. |
| RBAC | New permissions were added to the existing matrix. `canActOnResource` was **generalised** to take a resource rather than copied for papers. |
| Repository pattern | `paper.repo.ts` and `audit.repo.ts` are the only modules touching their models; services never call Mongoose. |
| `assertPermission` / `AuthContext` | Used unchanged throughout the new services. |
| `escapeRegExp` | Paper title search escapes and anchors, exactly as taxonomy search does. |
| Redacting logger | Reused as-is; `answer` and `correctOptions` were already in its redaction list, which covers the new export paths. |
| Rate limit interface | Three policies added; the store swap is one function call. |

**Zero duplicated logic.** The only new abstraction is
`buildRenderedPaper()`, which exists specifically to stop PDF and DOCX
duplicating each other.

---

## Statistics

| Metric | Step 1 | Step 2 | Δ |
|---|---|---|---|
| Files | 131 | 178 | +47 |
| TypeScript files | 120 | 167 | +47 |
| API route files | 22 | 28 | +6 |
| Models | 10 | 12 | +2 |
| Services | 5 | 9 | +4 |
| Repositories | 4 | 6 | +2 |
| Unit test suites | 7 | 13 | +6 |
| Integration suites | 2 | 3 | +1 |
| Permissions | 15 | 25 | +10 |
| Runtime dependencies | 7 | 11 | +4 |

---

## The three decisions worth arguing about

**1. Generation reports shortfalls instead of failing or padding silently.**
If a teacher asks for 6 hard questions and the bank has 3, the paper is built
with what exists and a warning names the gap. Failing outright would waste the
work; padding silently would hand over a paper that does not match the blueprint.
The dry-run endpoint exists so this is visible *before* saving.

**2. `totalMarks` is a target, not a constraint.**
Hitting an exact mark total requires either rejecting valid questions or
rewriting their marks. Both are worse than telling the teacher the total came to
38 instead of 40 and letting them adjust. This is reported as a
`MARKS_MISMATCH` warning.

**3. Origin validation rather than a CSRF token.**
A synchroniser token would mean adding state and a token endpoint for a JSON API
that already refuses non-JSON bodies. Origin validation gives the same guarantee
with no state, and `Sec-Fetch-Site` provides a second unforgeable signal. The
trade-off — non-browser clients that send no browser headers are allowed — is
documented and deliberate.

---

## Verification status

**`npm install`, `typecheck`, `lint`, `test` and `build` could not be run**: this
environment has no network access, so dependencies cannot be installed. This was
also true at the end of Step 1 and is recorded there.

What was verified — full detail in `TEST_RESULTS.md`: every file parses as valid
TypeScript, all 322 internal imports resolve, all 28 route files export handlers,
no banned patterns, no secrets, no filesystem persistence, no direct `process.env`
outside the config module.

Five real defects were found and fixed during self-review, since the compiler was
unavailable to catch them:

1. A duplicate import from the same module in `api/handler.ts`.
2. A projection conflict in `question.repo.ts` where `.select()` would have
   silently dropped the `textScore` meta-projection, breaking relevance sorting.
3. A `useEffect` in `TaxonomyManager` that refetched every parent dropdown on each
   keystroke.
4. An unnecessary `as Permission` cast that template-literal types already handle.
5. An invalid `sort` property passed to `taxonomyService.list` in the import page.

**Run `npm install && npm run verify` first.** Anything that surfaces will be a
type mismatch at a library boundary — most likely in `pdf-lib`, `docx` or
`nodemailer` — rather than a structural problem.

---

## Suggested next steps

1. `npm install && npm run verify`, then fix any library-boundary type errors.
2. Add a Bangla TTF to `public/fonts/` if Bangla PDF export is needed.
3. Wire Redis if more than one instance will run.
4. Configure SMTP before any production deployment — reset emails are not
   delivered without it.
5. Step 3 candidates: AI-assisted generation, organization management, analytics,
   section editing in the builder, and a CI pipeline.
