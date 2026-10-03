# AutoQgen Thesis Audit — Part 1: System Discovery

**Audit scope:** Current `main` branch at `b980a26` (repository was clean before this report was added).  
**Audit date:** 2026-10-03.  
**Method:** Read-only review of the current application routes, UI, API handlers, domain services, schemas, models, tests, configuration templates, scripts, and project documentation.  
**Artifact availability:** No separate artifact-generation facility was available in this session; this Markdown file is the deliverable.

This report describes the inspected code, not a live production deployment. Optional integrations may be disabled when credentials or services are not configured. API and UI behaviors are described separately where their access checks differ. Paths below are relative to the repository root. No secret values are reproduced.

---

## 1. Executive System Overview

AutoQgen is a web application for organizing educational questions and preparing question papers. The current implementation combines a searchable, taxonomy-linked question bank with authoring, bulk import, AI-assisted draft generation, review/approval, manual or rule-driven paper assembly, paper design, similarity review, and document export.

The system addresses the practical workflow of collecting questions with curriculum context, reviewing those questions, and reusing eligible material in assessments. Its visible users include platform administrators, organization owners and team administrators, teachers and other question authors, reviewers/moderators, and students or other basic members. The account role system and the per-organization membership role system are distinct; users do not receive the same capabilities merely because the same role name appears in both.

At a high level, the implemented workflow is:

1. An account signs in and works within an organization context where applicable.
2. A user creates questions, imports existing questions, or requests AI-generated drafts.
3. The questions are attached to academic taxonomy (such as category, subject, chapter, and optionally topic, board, or exam).
4. Authors or reviewers edit and review questions; review-capable users approve or reject submissions.
5. Paper authors assemble a paper manually or configure automatic selection from approved questions, optionally using an admission-paper subject allocation or saved pattern template.
6. The paper can be previewed, designed, checked for within-paper semantic similarity, printed, and exported as student or teacher PDF/DOCX copies, subject to permissions.

This is a description of implemented software capabilities, not a claim about educational outcomes or measured effectiveness. Public marketing and guide pages describe workflows but are not themselves evidence that every described workflow is operational; the application routes and services are the source of truth used here.

**Evidence:** `src/app/`, `src/components/`, `src/lib/services/`, `src/lib/validation/`, `src/models/`, `src/types/`.

---

## 2. Complete Feature Inventory

### Public information and product pages

- Landing page and product/organization information pages.
- About, contact, pricing, features, examples, solutions, resources, guide, FAQs, docs, blog, changelog, privacy, and terms pages.
- `/examples` redirects to `/resources/examples`.
- Platform overview pages describe the question bank, question generation, question review, paper builder, and import/export workflows. They are public explanatory pages rather than authenticated application screens.

### Authentication and accounts

- Email/password sign-in and optional Google OAuth provider.
- Self-registration; the server assigns the default global role (`member`), rather than trusting a role supplied by the registration form.
- Email verification and verification-email resend.
- Forgot-password and reset-password flow.
- Authenticated profile update, password change, and avatar/profile image URL handling.
- Session identity/status checks and protected dashboard/admin pages.
- Seed scripts for development/demo users and content.

### Organization, membership, and teams

- Platform administrators can create, list, update, and deactivate organizations; inspect organization details and members; and assign an owner.
- Organization members can view/switch their active organization and, subject to organization-role permissions, manage organization membership, invitations, teams, and settings.
- Invitation creation, listing, acceptance, rejection, cancellation/deletion, and invitation status handling.
- Team creation/update/removal and team-member role management.
- Separate global and organization-level permission matrices.
- Organization-aware records and organization filters exist across core content and paper workflows, with endpoint/service-level scoping as described in Sections 4 and 17.

### Academic taxonomy

- Category, subject, chapter, topic, board, and exam records.
- Taxonomy pages support browsing/search and permission-dependent create/update/delete controls.
- Parent-child context is used in question authoring, filtering, and paper setup.
- Taxonomy records are organization-scoped in the applicable service paths.

### Question bank and authoring

- Create, view, edit, deactivate/delete, and browse questions.
- Question data supports question type, difficulty, language, text and optional media/passage/LaTeX fields, options, answer, explanation, marks, estimated time, source/session/year, and tags.
- Taxonomy links include category, subject, chapter, optional topic, board, and exam.
- Question statuses are `DRAFT`, `PENDING`, `APPROVED`, and `REJECTED`.
- Owner/elevated permissions govern edits and deletion; reviewer permissions govern approval/rejection.
- Answer-key visibility is permission checked, not granted just by asking for answers in a query.
- Bulk review supports approving or rejecting selected questions with an optional review note.

### Question import

- A question-import page accepts CSV and JSON files.
- CSV parser supports quoted fields, escaped quotes, commas/newlines in quoted fields, LF/CRLF, and UTF-8 BOM removal; malformed column counts and mapping problems are reported.
- The UI maps files to a chosen category, subject, and chapter, previews parsing issues, and sends imports in sequential batches of up to 500 rows per request, with progress and per-row errors.
- JSON may be an array or an object containing a `questions` array.
- Imported questions are created as drafts; server validation and duplicate checks remain authoritative.

### AI-generated question drafts

- An AI page accepts taxonomy placement, question type, difficulty, language, requested count (1–20; default 10), and optional instructions.
- The system generates structured question candidates; the UI lets the user inspect/edit/select the output before importing.
- AI output can be marked as new, a detected exact-content duplicate, or requiring review; it is not automatically approved.
- A separate check endpoint can re-evaluate duplicate status after the user edits candidate text.
- Selected output is imported as draft questions and enters the normal review lifecycle.
- Active question generation uses the Ollama-compatible question-generation integration. Gemini generation code also exists, but the inspected active generation service uses Ollama; see Section 21.

### Question review and approval

- Review queue shows a review-capable user the relevant organization queue; users without review permission can see their own non-approved work and outcomes.
- Reviewers can filter the queue by status, open/edit questions, add a review note, approve/reject questions, and perform bulk status decisions.
- Creative question groups are displayed together and ordered by Bengali part label/order.
- Server-side permission and status-transition checks remain in place even when controls are hidden in the UI.

### Duplicate detection and similarity

- Question authoring/import and AI-draft workflows use normalized content fingerprints for exact duplicate detection.
- AI question results report duplicate status and can be rechecked after edits.
- Paper-level similarity review is a separate feature: it analyzes pairs only within the current paper, uses cached Gemini embeddings and cosine similarity to select candidates, and asks an Ollama LLM to determine whether a candidate pair is semantically similar.
- The similarity review UI presents flagged pairs and score percentages and supports keeping both or replacing a question with a generated candidate.

### Creative Question system

- Manual authoring of a linked group: one stimulus and four question records labeled `ক`, `খ`, `গ`, `ঘ`.
- The four parts have fixed marks of 1, 2, 3, and 4 respectively (10 total) in the manual form and corresponding cognitive-level labels.
- Each part has its own question type, text, answer/options/pairs, difficulty, language, and explanation.
- The group is submitted as four draft questions; they share group/stimulus metadata and are reviewed as a group in the queue.
- AI-assisted generation and selected-result import support a four-part creative group.
- Paper generation has a `creativeOnly` option that selects complete creative groups instead of isolated component questions.

### Paper creation and lifecycle

- Paper list, manual question selection, automatic paper generation, paper detail/edit, regeneration, cloning, publishing, archiving, and restoring.
- Paper types include model test, admission, exam, practice test, assignment, and other (labels/options in the builder).
- Paper metadata includes title, description, instructions, category, subject, optional board/exam/year, duration, and sections.
- Automatic generation draws from approved questions and supports question count, optional target marks, selected chapters/topics, difficulty/type/chapter quotas, mandatory and excluded question IDs, randomization options, and previous-question usage controls.
- Generation has a non-persisting availability/dry-run operation and a persist/generate operation. It reports selection counts and warnings/shortfalls.
- Question pattern templates store reusable generation and design settings; users with the required capability can browse/load, create, edit, delete, and duplicate templates.
- Paper statuses are `DRAFT`, `PUBLISHED`, and `ARCHIVED`. Publishing requires appropriate permission and a non-empty paper. Clone creates a new draft owned by the cloner.
- A paper has a single current record; the current model does not provide a revision archive/rollback, and explicitly distinguishes clone provenance from versioning.

### Admission-based papers

- Admission is a paper type available in the paper builder, not a separate application or API subsystem.
- A user can select multiple subjects, assign each a whole-number percentage, and select chapters for each subject.
- Validation rejects duplicate subject selections and requires selected admission percentages to sum to 100; an admission paper requires at least one admission subject.
- Availability is checked per generation specification; generation distributes the requested number of questions among the selected subjects and their eligible chapters.
- Percentage allocation concerns question counts in the generation specification, not a demonstrated guarantee of subject marks. Shortages are reported; the available code does not establish that every percentage can always be met if the eligible pool is insufficient.
- Admission subject settings are also supported in question-pattern templates.

### Preview, design, print, and export

- Paper detail provides paper preview and design controls, with configurable heading, layout, columns, numbering, fonts, paper size/orientation, margins, student information fields, header/footer, watermark, and related display options.
- Design changes update a live preview; saving persists design separately from question selection, and reset restores the last-saved design.
- Browser print action and print-specific CSS are implemented.
- Export offers student and teacher variants in PDF and DOCX.
- Student rendering omits answer keys; teacher rendering includes answers/explanations subject to the export-answer permission.
- PDF has optional embedded Unicode font loading for Bengali; fallback behavior is reported as degraded when the required font is unavailable.
- PDF uses the current unsaved design supplied by the UI; DOCX uses the saved design configuration. This difference is noted in Section 21.

### Dashboards and administration

- Main dashboard presents live question/taxonomy counts, the signed-in user's question/draft counts, and a pending-review count for users with review capability.
- Admin dashboard shows user totals/statuses/role breakdowns, question counts/statuses, paper totals/published papers, and audit-log counts.
- Admin users page supports listing/searching users, role/status administration, and user updates subject to constraints.
- Admin organization pages support organization creation, search/list, detail, member inspection, owner assignment, update, and activation management.
- Admin settings and audit-log screens are implemented.
- No paper performance, student-result, or usage-trend analytics dashboard was found in the inspected dashboard implementation.

### Question usage and paper history inputs

- Question-usage records track a question's inclusion in papers and paper type.
- Automatic generation can exclude, allow, or prefer previously used questions, bound the history to recent papers, and exclude questions used in a configured number of recent papers.
- This is a generation-selection history mechanism; it is not a question revision history or paper version archive.

### Audit, health, and system operations

- Mutating operations use an audit service/model; platform audit listing is provided to permitted users.
- Health endpoint is present.
- Typed configuration, structured logging/redaction, shared route handler, validation schemas, normalized API envelopes, and pluggable rate-limiting backends are implemented.
- Scripts include seed/demo data, organization-member migration, demo password update, sample question insertion, and paper-version cleanup/migration tooling.

**Evidence:** `src/app/`, `src/components/`, `src/lib/`, `src/models/`, `src/types/`, `scripts/`.

---

## 3. User Roles and Capabilities

AutoQgen has two role axes: a **global role on the user account** and a separate **organization role on a user–organization membership**. Organization roles are not simply aliases for global roles. The effective access to any specific action depends on the relevant route/service check and, for organization content, the organization context.

### Global/system-level roles

| Global role | Implemented capability summary |
|---|---|
| `super_admin` | Holds the global permission set, including platform user administration, organization management, audit access, content/taxonomy/paper actions, and answer-key export permissions. Organization owner assignment is a platform-admin operation. |
| `organization_owner` | Global permission set is content/admin-like (equivalent to global `team_admin` in the matrix); this role name alone does **not** grant platform-wide `user:read:any`, `user:manage-roles`, `audit:read`, or `organization:manage`. Organization-owner governance comes from an organization membership. |
| `team_admin` | Global content permissions include moderator-level actions plus bulk question import and taxonomy deletion; platform user administration/audit/organization-management permissions do not follow from the global role alone. Organization team governance is separate and limited to the assigned team. |
| `moderator` | Can review questions, update/delete others' questions, manage taxonomy create/update, publish/delete papers, and manage templates, subject to resource/context checks. |
| `reviewer` | Can review questions, update questions/papers beyond ownership where permitted, and use teacher-level question/paper capabilities. |
| `teacher` | Can create and manage own questions/papers, use AI generation/import, read questions/answers as allowed by the global matrix, export papers including teacher answers, and browse templates. |
| `content_writer` | Can create/edit/delete own questions and papers, generate/import AI output, read answers under the global matrix, export papers without the teacher-answer capability, and read templates; cannot approve its own generated content without review permission. |
| `student` | Global role grants taxonomy read and question read; it does not grant paper generation or answer-key access through the global matrix. |
| `member` | Default for self-registration. Has no global content permissions; account/profile and invitation interactions are available to authenticated users, and organization membership can separately unlock capabilities. |

The roles above are defined in `src/types/roles.ts`; global capabilities are in `src/lib/auth/rbac.ts`. User account statuses are `active`, `pending`, and `suspended`. The admin user editor's global-role choices are narrower than the full global role set (`super_admin` and `member`); organization roles are assigned in the organization-membership system.

### Organization-level roles

Organization roles exclude `super_admin` and are attached to a membership for a particular organization.

| Organization role | Implemented capability summary |
|---|---|
| `organization_owner` | Organization governance permissions: organization/member/invitation/team/role administration plus the role's content permissions, as defined in the organization matrix. Owner assignment itself is reserved for the super-admin operation. |
| `team_admin` | Team-scoped read/update/member-management capabilities for its assigned team; does not become an organization-wide owner or global platform administrator. It also has broad content capabilities in the organization permission matrix. |
| `teacher` | Ordinary member baseline plus question authoring/AI/import, own-content management, paper read/create/own management/export, and teacher-answer export in the organization matrix. |
| `content_writer` | Ordinary baseline plus authoring/AI/import, own-content management, paper read/create/own management, and export; no teacher-answer export. |
| `reviewer` | Teacher-like capabilities plus cross-owner question/paper update and question review. |
| `moderator` | Reviewer-like capabilities plus cross-owner question deletion, taxonomy create/update, paper deletion/publishing, and template management. |
| `student` | In the organization matrix, has the ordinary active-member baseline (question read, paper create, template read, taxonomy read); this differs from the global `student` matrix. |
| `member` | Same ordinary active-membership baseline; does not itself confer organization governance permissions. |

Organization membership statuses are `active` and `suspended`; invitation statuses include `pending`, `accepted`, `rejected`, `expired`, and `cancelled`. Exact permission matrices are in `src/lib/auth/org-rbac.ts` and `src/types/organization.ts`.

---

## 4. Organization / Multi-Tenant System

- **Organization creation and platform administration:** Super-admin-protected UI/API can create and update organizations, search/list them, inspect detail/member counts, change active state, inspect members, and assign an owner. Organization names/slugs are validated and duplicate slugs are rejected.
- **Membership and ownership:** Membership records connect users and organizations and carry the organization role and membership status. The owner can invite members and manage membership/roles subject to the organization matrix. Owner assignment is handled separately by the platform admin; reassignment demotes the former owner to team admin rather than simply leaving two owners.
- **Invitations:** Organization members with the relevant permission can send invitations and manage sent/pending invitations. Invited users can view, accept, or reject an invitation through the invitation page/API. Invitation status and expiry are represented in the model.
- **Teams:** Organizations can organize members into teams. Team admins' team operations are intended to apply to their assigned team, with team-ID and membership checks in team-specific routes/services.
- **Organization switching:** An authenticated user can switch the active organization; the current organization is used by organization-aware page/API operations. Dashboard organization pages include overview, switcher, members, invitations, teams, and settings.
- **Data association and isolation:** Organizations and membership are persisted separately. Core content records such as questions and papers have organization association; question/paper generation, availability, usage, embeddings, similarity review, and selected listing paths use an organization context. Super-admin APIs can accept an organization override in specified schemas; normal users do not control placement through import/AI request payloads.
- **Important scope qualification:** `src/lib/auth/org-rbac.ts` explicitly describes several organization content permissions as capability fallbacks and says membership alone does not decide which organization's questions/papers are visible. Therefore the existence of organization roles must not be presented as proof that every data-access path is automatically isolated. Isolation is enforced by the relevant organization-resolution and service/repository path; selected organization-isolation integration tests exist. A later technical audit should trace every endpoint before claiming universal tenant isolation.
- **Organization-specific settings:** An organization settings page and organization-level fields are implemented. Platform-wide settings are separate in the admin settings page.

**Evidence:** `src/models/Organization.ts`, `OrganizationMember.ts`, `OrganizationInvitation.ts`, `Team.ts`; `src/lib/auth/org-session.ts`, `org-rbac.ts`; `src/lib/services/organization.service.ts`, `organization-member.service.ts`, `invitation.service.ts`, `team.service.ts`; `src/app/dashboard/organization/`; `src/app/api/organization/`; `src/app/api/admin/organizations/`; `tests/integration/*org-isolation*.test.ts`.

---

## 5. Application Pages and Screens

`src/app` uses the Next.js App Router. The table inventories the page routes; a grouped row lists every route in that group. Public information pages are static/explanatory UI unless otherwise indicated. Access is subject to server-side/page-level checks in addition to middleware.

| Page / Route | Purpose | Main Users | Main Actions |
|---|---|---|---|
| `/` | Public landing page | Public; signed-in users see conditional dashboard entry | Learn about the product; enter the application |
| `/login` | Sign-in | Public | Submit credentials / optional provider sign-in |
| `/register` | Account registration | Public | Create account |
| `/forgot` | Password recovery request | Public | Request recovery email |
| `/reset` | Password reset | Public with valid reset link/token | Set a new password |
| `/verify-email` | Email verification/status | Public with verification link/context | Verify or request another verification email |
| `/invitations/[token]` | Invitation response | Invited user | Sign in as required; accept or reject invitation |
| `/about`, `/contact`, `/pricing`, `/privacy`, `/terms`, `/features` | Public information/legal pages | Public | Read product, contact, pricing, privacy, terms, and feature information |
| `/examples` | Legacy/alias route | Public | Redirect to `/resources/examples` |
| `/solutions`, `/solutions/teachers`, `/solutions/schools`, `/solutions/coaching-centers`, `/solutions/exam-setters` | Public audience/solution pages | Public | Read audience-specific workflow descriptions |
| `/resources`, `/resources/docs`, `/resources/examples`, `/resources/faq`, `/resources/guide`, `/resources/blog`, `/resources/changelog` | Public resource pages | Public | Read resources, guide, examples, FAQs, and changelog |
| `/platform`, `/platform/question-bank`, `/platform/question-generation`, `/platform/question-review`, `/platform/paper-builder`, `/platform/import-export` | Public product/workflow explanation pages | Public | Read descriptions of product areas; these are not interactive app pages |
| `/dashboard` | Authenticated application overview | Signed-in users | View question/taxonomy/review counts and navigate to permitted modules |
| `/dashboard/questions` | Question browser | Users with question-read capability | Search/filter/page through questions; open question details; enter create/review workflows |
| `/dashboard/questions/new` | Question authoring | Users with question-create capability | Create a standard question or start the creative-group form |
| `/dashboard/questions/[id]/edit` | Question editor | Owner or user with elevated update capability | Edit question details and answer; save changes |
| `/dashboard/questions/ai` | AI question generation | Users with AI-generation capability | Configure generation, inspect/edit candidates, recheck duplicates, select/import draft output |
| `/dashboard/questions/import` | Bulk file import | Users with global `question:bulk-import` on the page guard | Choose placement and CSV/JSON file; review parsing issues; import in batches |
| `/dashboard/review` | Review queue | Authors and users with review capability | Inspect status, filter, edit, approve/reject, add notes, bulk review |
| `/dashboard/categories`, `/dashboard/subjects`, `/dashboard/chapters`, `/dashboard/topics`, `/dashboard/boards`, `/dashboard/exams` | Taxonomy management | Users with taxonomy-read capability; write controls depend on permissions | Search/browse academic taxonomy and perform permitted changes |
| `/dashboard/papers` | Paper list | Users with paper-read capability | Browse/filter papers; open a paper |
| `/dashboard/papers/new` | Paper builder | Users with paper-create capability | Manually select questions or configure automatic generation; choose paper type including admission; use templates if permitted |
| `/dashboard/papers/[id]` | Paper detail, preview, design, lifecycle, export | Users allowed to read the paper | Edit/manage status as authorized, preview, design, print, export student/teacher PDF/DOCX |
| `/dashboard/papers/[id]/similarities` | Paper similarity review | Users authorized to access the paper and resolve its review | Run/view within-paper similarity check; keep both or replace a question |
| `/dashboard/templates` | Pattern-template list | Users with template-read capability | Search and select/load reusable generation/design patterns |
| `/dashboard/templates/new` | New template form | Users with template-management capability | Create a question-pattern template |
| `/dashboard/templates/[id]` | Template view/edit | Users with appropriate read/manage capability | View, edit, delete, duplicate template subject to capability |
| `/dashboard/organization` | Organization overview and switcher | Signed-in users with applicable organization context | View/switch organization and navigate to organization tools |
| `/dashboard/organization/members` | Member administration/list | Organization members with applicable member permissions | Search/list members; change roles/status or remove as authorized |
| `/dashboard/organization/invitations` | Invitation management | Organization members with invitation permissions | Create/send, view, cancel/manage invitations |
| `/dashboard/organization/teams` | Team management | Organization members with applicable team permissions | Create/edit/remove teams and manage team membership as authorized |
| `/dashboard/organization/settings` | Organization settings | Organization members with organization-update permission | View/update organization settings |
| `/dashboard/settings` | Personal settings | Any signed-in user | Update profile/account settings, avatar field, and password |
| `/admin` | Platform administration overview | Users admitted by admin-layout permission gate | View system-level user/question/paper/audit statistics |
| `/admin/users` | Platform user administration | Users with platform user-read/manage permissions | Search/list users and perform permitted role/status changes |
| `/admin/audit` | Audit-log administration | Users with audit-read capability | Browse audit events |
| `/admin/organizations` | Platform organization list | Users with organization-manage permission | Search/list/create/manage organizations |
| `/admin/organizations/[id]` | Organization administration detail | Users with organization-manage permission | Inspect/update organization, members, and owner |
| `/admin/settings` | Platform settings | Users admitted by the admin page's permission checks | View/update platform settings |

Error, loading, not-found, and global-error boundaries (`src/app/error.tsx`, `global-error.tsx`, `not-found.tsx`, and loading files) are implemented UI states, not separate user-facing feature routes.

**Route evidence:** `src/app/` and its page files; dashboard/admin navigation in `src/components/dashboard/Sidebar.tsx` and `src/components/admin/AdminSidebar.tsx`; page guards in the relevant page/layout files.

---

## 6. Major User Workflows

### Account registration and verification

1. A visitor opens `/register` and submits the registration form.
2. The server validates the submitted account fields; the role is set to the server-defined default `member`, not selected by the request.
3. Verification flow sends an account-verification message when email delivery is configured.
4. The user follows the verification link or requests a resend; verified/active status is used by authentication and protected routes.

**Evidence:** `src/app/(auth)/register/page.tsx`, `src/components/auth/RegisterForm.tsx`, `src/app/api/auth/register/route.ts`, `src/lib/services/auth.service.ts`, `src/app/api/auth/verify-email/route.ts`, `src/app/api/auth/resend-verification/route.ts`.

### Sign-in and protected-page access

1. A user opens `/login` and submits credentials or uses Google when configured.
2. Auth.js validates the account and its status and issues a JWT-backed session.
3. Middleware checks for a user identity before allowing dashboard/admin routes.
4. Server page layouts and API handlers perform further authentication and permission checks.

**Evidence:** `src/components/auth/LoginForm.tsx`, `src/lib/auth/options.ts`, `src/lib/auth/session.ts`, `src/middleware.ts`, `src/lib/api/handler.ts`.

### Password recovery

1. A visitor requests password recovery from `/forgot`.
2. The system responds without exposing whether an account exists and sends a reset email where configured.
3. The user submits the reset token and new password on `/reset`.
4. The token is validated/consumed and the password is changed; token/session version handling invalidates older credentials as implemented.

**Evidence:** `src/app/api/auth/forgot-password/route.ts`, `reset-password/route.ts`, `src/lib/services/password-reset.service.ts`, reset token model/repository, `src/components/auth/ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`.

### Organization creation and onboarding

1. A super admin creates an organization in the admin area.
2. A super admin assigns an active user as owner; owner assignment creates/updates membership and adjusts the former owner role when reassigned.
3. The owner or other permitted member invites users and assigns an allowed organization role.
4. The invitee opens the invitation route, signs in if required, and accepts or rejects the invitation.
5. Active members can switch current organization and use the organization/team tools allowed by their membership role.

**Evidence:** `src/app/admin/organizations/`, `src/components/admin/`, `src/app/dashboard/organization/`, `src/components/organization/`, `src/app/invitations/[token]/page.tsx`, organization/invitation API routes and services.

### Standard question authoring and review

1. An author selects category, subject, chapter, and optional taxonomy details.
2. The author supplies a question type, wording, answers/options, marks, difficulty, language, and optional metadata.
3. The server validates structural and type-specific answer rules, hierarchy references, organization context, and duplicate fingerprint.
4. The question enters a draft/pending state according to the implemented submission action.
5. A reviewer inspects it and may edit, approve, reject, or add a note; the service enforces reviewer permission and valid state transitions.
6. Approved questions become eligible for paper generation.

**Evidence:** `src/components/questions/QuestionForm.tsx`, `src/lib/validation/question.schema.ts`, `src/lib/services/question.service.ts`, `src/components/review/ReviewQueue.tsx`.

### Question file import

1. The user chooses a destination category, subject, and chapter.
2. The user selects CSV or JSON; the browser reads the file and maps it to question payloads.
3. The UI reports parse/mapping problems and offers an import action.
4. Requests are sent sequentially in groups of at most 500 questions.
5. The API validates each item, applies server-derived ownership/organization/status, checks duplicates, and returns inserted/failed counts and row errors.

**Evidence:** `src/components/questions/BulkImport.tsx`, `src/lib/import/csv.ts`, `/api/questions/bulk`, `src/lib/services/question.service.ts`.

### AI question generation

1. The user selects taxonomy placement, question type, difficulty/language, count, and optional instructions.
2. The server asks the configured Ollama-compatible service for structured output.
3. The service normalizes and checks the returned output and compares candidate text with existing questions for duplicates.
4. The UI presents generated candidates and duplicate/review indications; the user can inspect/edit/select results.
5. Selected questions are imported as drafts, not automatically approved.

**Evidence:** `src/components/questions/AiGenerate.tsx`, `src/lib/ai/question-generation-ollama.ts`, `src/lib/services/ai-question.service.ts`, `/api/questions/ai-generate`, `/api/questions/ai-check`, `/api/questions/ai-import`.

### Creative-question authoring

1. The author selects category, subject, chapter, and optional topic and enters a shared stimulus.
2. The author fills four linked parts (`ক`, `খ`, `গ`, `ঘ`), each with a type-appropriate question/answer and a fixed mark/cognitive-level association in the manual form.
3. The server validates the group and stores the four parts as draft question records sharing creative-group/stimulus metadata.
4. Review queue groups the parts for joint display/review; paper generation can preserve/select complete groups.

AI generation can create the same four-part structure, after which the user can inspect and import it as drafts.

**Evidence:** `src/components/questions/CreativeGroupForm.tsx`, `src/components/questions/AiGenerate.tsx`, `src/lib/validation/question.schema.ts`, `src/lib/services/question.service.ts`, `src/components/review/ReviewQueue.tsx`.

### Paper creation, generation, and regeneration

1. The paper author creates a paper with type/title and either manually chooses questions or configures an automatic generation blueprint.
2. The automatic blueprint specifies taxonomy, chapters/topics, question count, optional target marks and distributions, mandatory/excluded questions, randomization, and question reuse rules.
3. The builder can request a dry-run/availability result; the system returns selected/available counts and warnings without persisting the dry-run.
4. On save/generate, the server selects eligible approved questions and persists the paper.
5. The author can update details/design, regenerate the question selection, or clone the paper; clone creates a fresh draft.
6. Permitted users publish/archive/restore papers; a paper lifecycle action records the corresponding status/timestamps.

**Evidence:** `src/components/papers/PaperBuilder.tsx`, `GenerateTab.tsx`, `src/lib/services/paper-generator.service.ts`, `paper.service.ts`, `src/app/api/papers/generate/route.ts`, `/api/papers/[id]/regenerate`, `/api/papers/[id]/actions`.

### Admission paper generation

1. The author chooses admission paper type.
2. The author chooses multiple subjects, assigns each a percentage, and selects chapters for those subjects.
3. The form/schema validates distinct subjects and requires percentages to total 100%.
4. Availability/generation distributes the question-count target across the selected subjects and eligible chapters; insufficient eligible questions are represented through availability/warnings rather than an unconditional guarantee.
5. The resulting paper follows the usual preview/design/status/print/export path.

**Evidence:** `PaperBuilder.tsx`, `paper.schema.ts`, `paper-generator.service.ts`, paper generation API routes, `tests/integration/paper-service.test.ts`.

### Paper similarity review and resolution

1. A user opens a paper's Similarities screen and runs the check.
2. The system embeds the questions in that paper (reusing cache entries where source hash and model match).
3. Pairwise cosine similarity selects candidates at or above the configured 0.90 candidate threshold.
4. Ollama semantically validates candidate pairs; only pairs with positive verdicts are shown as similar.
5. The UI shows the cosine percentage and allows keeping both questions or replacing one; replacement tries generated candidates and returns a result/review.

**Evidence:** `src/components/papers/SimilarityReview.tsx`, `src/lib/services/paper-similarity.service.ts`, `src/lib/ai/ollama.ts`, similarity API routes.

### Paper preview, print, and export

1. The user opens paper detail and adjusts design options in the live preview.
2. The user may save/reset the design configuration.
3. Print triggers browser printing with print-specific layout styling.
4. Export selects PDF or DOCX and student or teacher variant.
5. The server authorizes access, builds the requested rendering, records the export in the audit trail, and returns the file; teacher answers require the applicable permission.

**Evidence:** `src/components/papers/PaperDetail.tsx`, `PaperPreview.tsx`, `DesignTab.tsx`, `src/lib/export/`, `/api/papers/[id]/export`.

---

## 7. Question Management System

Questions are the reusable content unit of the system. Each record can link to category, subject, chapter, optional topic/board/exam; include one of the configured question types; carry difficulty and language; and store text plus optional image/audio/video/passage/LaTeX content. Types with options, boolean answers, or matching pairs have corresponding answer fields; written types can carry text answers/explanations. Other metadata includes marks, estimated time, source/session/year, tags, creator/updater, active state, review note, AI origin, and creative-group fields.

Question lifecycle operations include creating, viewing, editing, soft-deactivation/deletion under permission rules, listing/searching, filtering, pagination, submitting/reviewing status, and bulk approve/reject. Statuses are `DRAFT`, `PENDING`, `APPROVED`, and `REJECTED`. Review state transitions are enforced in the service. Non-reviewers are generally restricted to approved content and their own non-approved content under the relevant query rules. Paper generation hard-locks its eligible status to approved.

Question list controls support text search and filters for organization (privileged override), category, subject, one/multiple chapters, topic, board, exam, question type, difficulty, language, status, year, tags, AI-generated flag, ownership (`mine`), creative/normal questions, creative group(s), and whether to request answer fields. Supported sort modes are newest, oldest, and relevance. Pagination has defaults and a bounded maximum.

Question records can be imported as CSV/JSON or generated by AI; in both cases server-side validation and duplicate detection apply. The question model does not represent a separate historical revision timeline.

**Evidence:** `src/models/Question.ts`, `src/types/question.ts`, `src/lib/validation/question.schema.ts`, `src/lib/services/question.service.ts`, `src/lib/repositories/question.repo.ts`, `src/components/dashboard/QuestionBrowser.tsx`, `src/components/questions/QuestionForm.tsx`.

---

## 8. AI-Powered Functionality

| Feature | Purpose / location | User input | System processing/output |
|---|---|---|---|
| Standard AI question generation | `/dashboard/questions/ai`; `/api/questions/ai-generate` | Category, subject, chapter, optional topic, question type, difficulty, language, count, optional instruction | Structured question candidates normalized for the question schema and presented for user inspection |
| AI candidate quality checks | AI-generation service and normalizer | Generated candidate content and its question type | Detects malformed/placeholder output and type-related issues; candidates may be marked for review rather than silently accepted |
| AI candidate duplicate check | AI-generation service and `/api/questions/ai-check` | Generated or edited question text and chapter context | Compares normalized content fingerprints with existing questions; returns duplicate flags/known matching question identifiers where available |
| AI import | `/api/questions/ai-import` and AI page | User-selected/edited candidates and taxonomy placement | Persists selected questions as AI-origin drafts for normal review |
| Creative-question generation | `/api/questions/ai-creative-generate` | Taxonomy placement, difficulty/language, optional instruction | A shared stimulus and four linked Bengali-labeled parts for review |
| Creative AI import | `/api/questions/ai-creative-import` | User-selected creative group and placement | Stores four linked draft question records |
| Paper semantic similarity embeddings | Paper Similarities feature | Existing questions in a paper (no cross-bank scan) | Gemini embeddings for each question's stem, passage, and option text when applicable; cached by model/source fingerprint |
| Paper similarity semantic validation | Similarities service | Candidate pairs from the current paper | Ollama LLM returns pairwise semantic verdicts; positive pairs are shown in review |

**Provider distinction:** The inspected active question-generation service uses the Ollama-compatible question-generation client. Gemini's `embedTexts` is used for paper similarity. A Gemini JSON-generation method is present in the client but no active application call site was found during this audit. Configuration comments that still describe Gemini as powering question generation are stale relative to the call path.

**Evidence:** `src/lib/services/ai-question.service.ts`, `src/lib/ai/question-generation-ollama.ts`, `src/lib/ai/question-prompt.ts`, `src/lib/ai/question-normalise.ts`, `src/lib/ai/gemini.ts`, `src/lib/ai/ollama.ts`, `src/lib/services/paper-similarity.service.ts`, `src/lib/validation/ai-question.schema.ts`, related API routes and tests.

---

## 9. Similarity / Duplicate Detection

AutoQgen implements two distinct kinds of duplicate/similarity handling:

1. **Question duplicate fingerprinting:** Question creation, import, and AI candidate handling compute normalized content hashes and compare against existing question hashes in the relevant context. Duplicate items are reported/rejected or marked as duplicate rather than treated as new approved content. This is exact/normalized duplicate handling; no user-visible numeric similarity threshold is exposed for this question-level check.
2. **Paper semantic similarity review:** The explicit Similarities feature considers all unique question pairs within the current paper, not the whole question bank. It obtains cached/new Gemini embeddings, calculates cosine similarity, and sends only candidate pairs with cosine `>= 0.90` to the Ollama semantic validator. A pair is flagged only when the semantic validator returns a positive verdict. The UI displays the cosine percentage (not an LLM confidence score).

Users can inspect the flagged pair, keep both questions, or request replacement. Replacement candidates are generated and checked, with up to three replacement attempts configured. Results are scoped to the paper/organization and persisted/recomputed through similarity APIs as implemented. Papers with fewer than two questions return a note rather than a pair list.

There is no separate global question-bank semantic search/duplicate dashboard established by this implementation.

**Evidence:** `src/lib/services/question.service.ts`, `src/lib/services/ai-question.service.ts`, `src/lib/security/hash.ts`, `src/lib/services/paper-similarity.service.ts`, `src/lib/similarity/config.ts`, `src/lib/similarity/cosine.ts`, `src/components/papers/SimilarityReview.tsx`, `src/models/QuestionEmbedding.ts`, `src/models/PaperSimilarityReview.ts`.

---

## 10. Creative Question System

The current implementation represents a creative question as a linked set of four question records rather than relying on an obsolete/deleted standalone creative-question model.

- The author enters one shared stimulus and creates four associated parts labeled `ক`, `খ`, `গ`, and `ঘ`.
- The manual form associates those labels with knowledge, understanding, application, and higher-order cognitive levels and marks of 1, 2, 3, and 4.
- The parts can use supported question types, and each has its own text, answer structure, language, difficulty, and explanation.
- The API requires exactly four parts and a non-empty bounded stimulus; service-level creation associates the parts under one creative group and creates drafts.
- The AI path generates a stimulus and four parts; user selection/import is required and imported parts enter as drafts.
- The review queue groups related parts and orders them by part position, allowing review of the linked set.
- Question browsing can distinguish creative-only versus normal questions and filter by creative group.
- Paper generation can select complete creative groups via `creativeOnly`; group-aware selection avoids treating one part as an independent question in that mode.
- Paper preview/export supports rendering creative stimulus and its grouped parts.
- The inspected sources show creative group creation, AI generation/import, editing/review through the shared question workflow, and paper use. They do not establish a separate creative-group approval object; approval is applied to question records through the shared question status system.

**Evidence:** `src/components/questions/CreativeGroupForm.tsx`, `src/components/questions/AiGenerate.tsx`, `src/models/Question.ts`, `src/lib/validation/question.schema.ts`, `src/lib/services/question.service.ts`, `src/components/review/ReviewQueue.tsx`, `src/lib/services/paper-generator.service.ts`, `src/lib/export/paper-document.ts`.

---

## 11. Paper Generation System

### Paper authoring modes and content

- Manual paper creation supports title/description/instructions, category/subject, optional board/exam/year, duration, sections, question ordering, marks overrides, and notes.
- The builder also provides automatic generation. The server has a dry-run/availability call and a persist/generate call.
- Automatic generation requires a category, subject, at least one chapter, and a bounded question count. It selects from approved questions only.
- Blueprint controls include topic/chapter selection, question type and difficulty distributions, per-chapter quotas, mandatory/excluded question IDs, optional language/year/board/exam, target marks, and randomization of selection/order/options.
- Previous-question settings can exclude, allow, or prefer previously used questions and can limit history to recent papers. Another recent-paper exclusion option is implemented.
- Selection produces counts/warnings; requested quota/mark targets are not represented as a guarantee that every requested distribution can be met when the eligible pool is insufficient.
- Creative-only generation selects complete creative groups.

### Paper management and lifecycle

- Paper records can be listed, created, read, edited, deleted/deactivated, generated, and regenerated.
- Regeneration updates selection/configuration in the existing paper record; it is not an archived revision creation workflow.
- Paper actions include publish, archive, restore, and clone. Publishing requires publish permission and at least one question. Clone creates a new draft owned by the cloning user.
- Paper statuses are `DRAFT`, `PUBLISHED`, and `ARCHIVED`.
- A question-pattern template can preserve reusable generation/design configuration and be duplicated/managed according to permissions.
- Paper detail supports live preview, design settings, similarity review, print, and export.
- Export formats are PDF and DOCX; variants are student and teacher.
- Print uses the browser's print support. PDF's rendering can report degraded Unicode output if its optional Bengali font is missing.

### Marks and paper design

Paper data stores total question/mark values computed by server-side behavior. Question/section-level marks can be assigned/overridden; design settings customize layout/presentation but do not mutate question selection. Current design settings include page size/orientation, margins, columns, numbering, font sizes/family, header/organization information, student fields, output switches, watermark/header/footer bands, and booklet/layout options.

**Evidence:** `src/components/papers/PaperBuilder.tsx`, `GenerateTab.tsx`, `PaperDetail.tsx`, `PaperPreview.tsx`, `DesignTab.tsx`, `RegeneratePanel.tsx`, `src/lib/validation/paper.schema.ts`, `src/lib/services/paper.service.ts`, `paper-generator.service.ts`, `paper-export.service.ts`, `src/lib/export/`.

---

## 12. Admission-Based Paper System

Admission support is implemented as `paperType: "ADMISSION"` in the shared paper builder/generation pipeline.

- The user selects multiple subjects and gives each an integer percentage from 1 to 100.
- Percentages must sum to 100; repeated subject IDs are invalid; the admission paper schema requires at least one subject allocation.
- The user chooses chapters for each subject; chapter and subject references are validated for generation.
- Availability can be requested for the combined generation specification.
- Automatic selection apportions the question-count target among the chosen subjects and applies chapter/question eligibility rules.
- Warnings/shortfalls are the mechanism for reporting insufficient candidates; the source does not establish that subject percentages guarantee exact selected questions or marks when candidate supply is inadequate.
- Admission allocation also exists in saved question-pattern template configuration.
- The paper uses the same design, preview, lifecycle, export, and print flows as other paper types.

There is no separate admission-only page route; the feature is within `/dashboard/papers/new` and the shared paper generation and template schemas/services.

**Evidence:** `src/components/papers/PaperBuilder.tsx`, `src/lib/validation/paper.schema.ts`, `src/lib/validation/question-template.schema.ts`, `src/lib/services/paper-generator.service.ts`, `src/app/api/papers/generate/route.ts`, `tests/unit/paper-schema.test.ts`, `tests/unit/question-template-schema.test.ts`, `tests/integration/paper-service.test.ts`.

---

## 13. Dashboard and Administrative Features

### Main dashboard

The main dashboard displays organization-scoped counts for approved questions, the current user's questions and drafts, and taxonomy totals for categories, subjects, chapters, and topics. A pending-review count is included when the caller has review capability; otherwise it is not exposed as a numeric count. These are question-bank/taxonomy statistics, not paper-performance analytics.

### Platform admin dashboard

The platform admin overview includes user totals, active/suspended counts and role breakdown, question total/status counts, paper total/published counts, and audit-log counts. Separate screens manage users, organizations, audit records, and platform settings. These are administrative totals; the inspected UI does not provide student performance analytics or paper-result tracking.

### Organization dashboard

Organization overview/switcher, organization member management, invitations, teams, and organization settings are provided under the dashboard organization area, with role-gated controls and empty/denied states where relevant.

**Evidence:** `src/app/dashboard/page.tsx`, `src/lib/services/dashboard.service.ts`, `src/app/admin/page.tsx`, `src/app/admin/users/page.tsx`, `src/app/admin/audit/page.tsx`, `src/app/admin/organizations/`, `src/app/admin/settings/page.tsx`, `src/app/dashboard/organization/`.

---

## 14. Search, Filtering, Sorting and Pagination

| Module | Implemented discovery controls |
|---|---|
| Question bank | Text search; organization override for privileged users; category, subject, chapter/chapter-set, topic, board, exam, type, difficulty, language, status, year, tags, AI-generated, own-content, creative/normal, and creative-group filters; newest/oldest/relevance sorting; bounded page/limit pagination |
| Review queue | Status filter, paginated results, own-work restriction for non-reviewers; creative group display |
| Taxonomy | Search by name/slug and parent-context filters; pagination in list APIs |
| Paper list | Search/filter/list behavior and pagination through paper query schema; organization and status/subject filters are represented in the paper list/API |
| Paper builder | Taxonomy-based category/subject/chapter/topic selection, search within chapters/templates/questions, and availability by selected blueprint |
| Question templates | Template search/list pagination and organization scoping |
| Organization admin | Search by organization name/slug, optional active filter, pagination |
| Organization members/invitations/teams | Organization-scoped lists, search/pagination where implemented in the corresponding page/API |
| Admin users | Search, role/status filters, and pagination in the user administration list |
| Audit log | Query filters and pagination supported by the audit query schema/API |

No general cross-module sorting capability should be inferred beyond the sort fields supported by each module's schema/service.

**Evidence:** `src/lib/validation/question.schema.ts`, `paper.schema.ts`, `question-template.schema.ts`, `taxonomy.schema.ts`, `organization.schema.ts`, audit/admin schemas/services; `src/components/dashboard/QuestionBrowser.tsx`, `TaxonomyManager.tsx`, `PaperList.tsx`, `TemplateList.tsx`, `OrganizationMembersTable.tsx`, `UserTable.tsx`.

---

## 15. Notifications, Email and External Integrations

| Integration | Purpose and implementation |
|---|---|
| MongoDB / Mongoose | Persistent users, questions, taxonomy, organizations, papers, templates, audit and workflow records. Connection/configuration lives in `src/lib/db/` and `src/lib/config/env.ts`. |
| Auth.js / NextAuth | Credentials-based authentication/session and optional Google OAuth provider. Google sign-in is disabled unless both provider values are configured. |
| Ollama-compatible hosted API | Active AI question generation and semantic validation for paper-similarity candidates; separately configurable keys/model settings are used for the two functions. |
| Google Gemini API | Question text embeddings for paper-level semantic similarity. The client also has a JSON-generation helper, but an active application call site was not found for that helper. |
| Brevo transactional email | Optional account/password/invitation email delivery when its required configuration is complete; selected ahead of SMTP in the email integration. |
| SMTP / Nodemailer | Alternative transactional email transport. A development console transport is available when remote email is not configured; production configuration behavior is validated/logged. |
| Redis or Upstash REST | Optional shared rate-limit storage. Redis URL or Upstash REST configuration can replace the process-local in-memory store; configured Upstash is preferred by the documented settings. |
| Browser print | Uses the user's browser print dialog and application print CSS; not a server-side printing service. |
| PDF/DOCX libraries | `pdf-lib` and `docx` create exports in-process; these are code dependencies, not external hosted services. |

No payment processor, analytics provider, or third-party deployment platform integration was established as a user-facing feature by the inspected source. Configuration can derive deployment URL values from platform environment variables, but that alone does not establish a deployment integration.

**Evidence:** `src/lib/config/env.ts`, `src/lib/ai/`, `src/lib/email/`, `src/lib/rate-limit/`, `src/lib/db/`, `src/lib/export/`, `src/lib/auth/options.ts`, `package.json`.

---

## 16. Validation and Error Handling Features

- Zod schemas validate account/auth, taxonomy, question, AI, paper, template, organization, query, pagination, and API input structures.
- Question validation enforces text/options/pair/tag/metadata bounds, supported types/statuses/difficulties/languages, and type-specific answer rules in the service.
- Taxonomy hierarchy/reference consistency is validated server-side.
- Server-derived identifiers/status/ownership/approval fields are not trusted from ordinary client input; imports force draft state.
- Duplicate content hashes are checked for question create/import and surfaced in AI candidate state.
- Bulk question requests cap items at 500 per request; bulk review has its own cap.
- Paper validation bounds section/question counts, distributions, chapter/subject counts, question counts and marks; admission allocations must be unique and sum to 100%.
- Paper generation requires approved questions and reports shortfall/warning data rather than silently treating unavailable quota as selected.
- Registration, login/reset, AI-provider, database/domain, authorization, and validation errors are handled through typed errors and standardized API responses.
- AI API errors include disabled/unavailable, upstream rejection/rate limit, malformed/empty response, and incomplete validation results; clients display errors and retry/adjust where the UI supports it.
- UI forms display field/global errors, toast messages, loading/empty/denied states, and unsaved-change confirmation in applicable pages.
- API handler centralizes schema validation, request-size bounds, authentication/permission checks, rate limiting, database connection, origin checking, and error normalization for the routes using it.

**Evidence:** `src/lib/validation/`, `src/lib/errors/`, `src/lib/api/handler.ts`, `src/lib/services/`, form components, `tests/unit/validation.test.ts`, `errors.test.ts`, `csv-import.test.ts`, `paper-schema.test.ts`.

---

## 17. Security and Access-Control Features

The inspected implementation includes:

- Auth.js JWT/session-based identity with account status checks.
- Middleware gates `/dashboard` and `/admin` on session identity; layouts, pages, API handlers, and services add further checks.
- Separate global and organization permission matrices; ownership checks distinguish own-resource from elevated cross-owner edit/delete.
- User/organization membership status and role checks; team-scoped authorization checks for team management.
- Organization context resolution and organization-scoped reads/writes in relevant question, paper, similarity, and usage flows.
- Password hashing and password policy through auth/password utilities; reset-token storage and verification through dedicated model/repository/service.
- Role/status and ownership fields are server-derived or excluded from client schemas where appropriate.
- Answer keys and teacher-copy export are guarded by dedicated permissions.
- Trusted origin/Referer/Sec-Fetch-Site checks for state-changing API calls.
- Rate limiting with memory/Redis/Upstash stores and specific auth/signup policies.
- Regex escaping and safe search handling; pagination bounds; body-size limits in the shared route handler.
- Structured logging with redaction and standardized errors that avoid returning internal exception details to API clients.
- Append-only-style audit recording for supported mutations and an audit-read permission.
- Production environment validation for database/auth configuration, optional service consistency, and HTTPS deployment URL constraints.

This section records mechanisms visible in code; it is not a penetration test or assurance that every route is free of authorization defects. UI and API guard differences identified during inspection are listed in Section 21.

**Evidence:** `src/middleware.ts`, `src/lib/auth/`, `src/lib/api/handler.ts`, `src/lib/security/`, `src/lib/rate-limit/`, `src/lib/services/audit.service.ts`, `src/models/AuditLog.ts`, validation schemas, `tests/unit/security.test.ts`, `origin.test.ts`, `rbac.test.ts`, `org-rbac.test.ts`.

---

## 18. Testing and Quality-Related Features

The repository contains **21 unit test files**, **15 integration test files**, and **one Playwright end-to-end spec**. Test files are present; this audit did not execute the test suites, so no pass/fail or coverage claim is made.

### Unit-test areas

- Admin permission/role constraints and protection against removing the last active super admin or self-demoting/self-suspending: `tests/unit/admin.test.ts`.
- AI prompts, normalization, malformed output/quality checks, creative-question output: `ai-question.test.ts`.
- Auth options/session provider behavior: `auth-options.test.ts`.
- CSV parsing/mapping: `csv-import.test.ts`.
- Email template behavior and escaping: `email.test.ts`.
- Error normalization, query pagination, rate-limit store, state-changing origin checks, regex/hash/log/password security helpers.
- Global/org RBAC: `rbac.test.ts`, `org-rbac.test.ts`.
- Question type-answer validation, hierarchy, answer protection, and question status transitions.
- Paper schema, generator quota/slot planning, rendered document content and student/teacher answer handling.
- Template schema and similarity math/prompt/verdict parsing.
- Toast UI behavior.

### Integration-test areas

- Admin user/organization workflows; organization service, role assignments, member-content access, review queue and bulk-import organization isolation.
- AI question generation/import.
- Question creation/update/status/duplicate/availability behaviors.
- Paper generation/service, admission allocation, previous-question usage, smart generation, regeneration, template lifecycle, and paper similarity workflow.
- Password reset persistence/token behavior.

Integration test setup can use a configured MongoDB or `mongodb-memory-server`; `tests/integration/README.md` describes prerequisites and that integration suites can skip when a database is unavailable.

### End-to-end tests

`e2e/auth.spec.ts` uses Playwright for authentication-related browser/API flows and expects a running/seeded application where needed. `playwright.config.ts` configures the base URL and web server behavior.

**Evidence:** `tests/unit/`, `tests/integration/`, `tests/integration/README.md`, `e2e/auth.spec.ts`, `playwright.config.ts`, `package.json`.

---

## 19. Complete Module Map

| Module | Main Purpose | Main Users | Key Features |
|---|---|---|---|
| Public site/resources | Explain product and workflows | Public | Landing, product, audience, legal, guide, and resource pages |
| Authentication/account | Authenticate and manage accounts | Visitors and signed-in users | Register, login, verification, reset, profile, password |
| Organization management | Manage tenant membership/governance | Super admins, owners, team admins, members | Organization CRUD/admin, switching, invites, members, teams/settings |
| Taxonomy | Organize curriculum context | Authors, reviewers, taxonomy managers | Categories, subjects, chapters, topics, boards, exams |
| Question bank | Create/find/reuse questions | Authors, reviewers, students/readers | Question CRUD, statuses, answer visibility, filters |
| Question import | Bring existing data into bank | Bulk-import-capable users | CSV/JSON mapping, batch upload, validation/errors |
| AI question generation | Produce editable draft questions | AI-generation-capable users | Standard and creative generation, duplicate state, selected import |
| Question review | Approve/reject submissions | Authors, reviewers, moderators | Queue, status filter, notes, edit, bulk decision |
| Creative questions | Model linked stimulus-based question groups | Authors, reviewers, paper authors | Four Bengali parts, shared stimulus, group review and paper selection |
| Similarity review | Find similar questions inside a paper | Paper viewers/reviewers | Gemini embeddings, cosine candidate score, Ollama verdict, keep/replace |
| Paper builder/generator | Assemble assessment papers | Paper authors | Manual/auto, distributions, exclusions, previous usage, admission |
| Pattern templates | Reuse paper-generation/design configuration | Template readers/managers | List/load/create/edit/delete/duplicate |
| Paper lifecycle | Manage saved papers | Paper authors and moderators | Draft/publish/archive/restore/clone/regenerate |
| Paper design/preview/export | Format and distribute papers | Paper viewers/export-capable users | Preview, design, browser print, student/teacher PDF/DOCX |
| Dashboard | Show current-bank work counts | Signed-in users | Live question/taxonomy/review counts |
| Platform admin | Operate platform-level records | Super admins/authorized platform admins | Users, organizations, global settings, audit, totals |
| Audit/operations | Record and inspect changes / operational health | Authorized administrators, operators | Audit events, health endpoint, logging |
| Configuration/rate limits | Configure runtime integrations and abuse controls | Operators/deployers | Validated env, email/AI/DB, memory/Redis/Upstash rate limiting |

---

## 20. Complete Feature Matrix

“Partially Implemented” means source code exists but the surfaced behavior is limited or an active integration/call path is unclear. “Not Implemented” is limited to specifically audited capabilities such as a separate paper revision archive; it is not a statement about every conceivable feature.

| ID | Module | Feature | Implemented? | Main User(s) | Thesis Relevance |
|---|---|---|---|---|---|
| F01 | Public site | Product, legal, resources, audience and workflow pages | Implemented | Public | System context and intended audience |
| F02 | Authentication | Credentials login and session | Implemented | All account users | Account access |
| F03 | Authentication | Optional Google OAuth | Implemented | All account users | External identity provider |
| F04 | Accounts | Registration with server-assigned default role | Implemented | Visitors | Account onboarding and least privilege |
| F05 | Accounts | Email verification/resend | Implemented | New users | Account activation workflow |
| F06 | Accounts | Forgot/reset password and password change | Implemented | All users | Account recovery/security |
| F07 | Accounts | Profile/settings/avatar handling | Implemented | Signed-in users | User self-service |
| F08 | Authorization | Global role and permission matrix | Implemented | All roles | Access-control model |
| F09 | Organization | Organization creation/update/deactivation | Implemented | Super admin | Multi-organization administration |
| F10 | Organization | Owner assignment and membership roles | Implemented | Super admin/owners | Tenant governance |
| F11 | Organization | Invitations and acceptance/rejection | Implemented | Owners/invitees | Member onboarding |
| F12 | Organization | Organization switching | Implemented | Multi-org members | Active tenant context |
| F13 | Organization | Team management and team-scoped access | Implemented | Owners/team admins | Internal organization structure |
| F14 | Organization | Organization content/data isolation | Partially Implemented | Organization users/admins | Tenant boundaries; verify all endpoint paths |
| F15 | Taxonomy | Category/subject/chapter/topic/board/exam management | Implemented | Authors/taxonomy managers | Academic classification |
| F16 | Questions | Standard question CRUD and metadata | Implemented | Authors/reviewers | Core reusable content |
| F17 | Questions | Draft/pending/approved/rejected lifecycle | Implemented | Authors/reviewers | Content governance |
| F18 | Questions | Search/filter/sort/pagination | Implemented | Question-bank users | Content discovery |
| F19 | Questions | Exact/normalized duplicate fingerprints | Implemented | Authors/importers | Duplicate prevention |
| F20 | Question import | CSV and JSON import | Implemented | Bulk-import users | Legacy-content ingestion |
| F21 | Question import | Sequential batches, progress and row errors | Implemented | Bulk-import users | Operational import workflow |
| F22 | AI questions | Ollama-backed structured question generation | Implemented | AI-generation users | AI-assisted authoring |
| F23 | AI questions | Candidate review/edit/select/import as drafts | Implemented | AI-generation users | Human-in-the-loop generation |
| F24 | AI questions | Duplicate state/check after editing | Implemented | AI-generation users | Draft quality handling |
| F25 | AI questions | Gemini JSON question generation | Partially Implemented | No active UI call site found | Code helper exists; active question generation uses Ollama |
| F26 | Creative questions | Manual four-part group with shared stimulus | Implemented | Authors | Curriculum-specific structured questions |
| F27 | Creative questions | AI creative generation/import | Implemented | AI-generation users | AI-assisted group authoring |
| F28 | Creative questions | Grouped review and complete-group paper selection | Implemented | Reviewers/paper authors | Preserve linked structure |
| F29 | Review | Review queue and approve/reject notes/actions | Implemented | Reviewers/moderators | Content quality workflow |
| F30 | Review | Bulk approve/reject | Implemented | Reviewers/moderators | Batch moderation |
| F31 | Similarity | Within-paper Gemini embedding/cosine candidates | Implemented | Paper users | Redundancy review |
| F32 | Similarity | Ollama semantic verdict and score display | Implemented | Paper users | Human decision support |
| F33 | Similarity | Keep both or generated replacement | Implemented | Paper users | Resolve similar pairs |
| F34 | Paper builder | Manual paper/question selection | Implemented | Paper authors | Assessment composition |
| F35 | Paper builder | Automatic question selection from approved bank | Implemented | Paper authors | Rule-based generation |
| F36 | Paper builder | Difficulty/type/chapter distributions and mandatory/excluded questions | Implemented | Paper authors | Blueprint configuration |
| F37 | Paper builder | Availability/dry-run, counts and warnings | Implemented | Paper authors | Feasibility feedback |
| F38 | Paper builder | Prior-use preference/exclusion controls | Implemented | Paper authors | Question reuse management |
| F39 | Paper type | Admission multi-subject percentage generation | Implemented | Paper authors | Admission-exam workflow |
| F40 | Paper templates | Save/load/manage/duplicate question-pattern templates | Implemented | Template readers/managers | Reusable generation/design presets |
| F41 | Paper lifecycle | Draft/publish/archive/restore/clone/regenerate | Implemented | Paper authors/moderators | Paper state management |
| F42 | Paper version history | Revision archive/rollback of prior paper snapshots | Not Implemented | — | Avoid claiming paper version history |
| F43 | Paper design | Live preview and configurable output design | Implemented | Paper authors | Document presentation |
| F44 | Paper print | Browser print with print styles | Implemented | Paper users | Physical-paper output |
| F45 | Paper export | Student/teacher PDF and DOCX | Implemented | Export-capable users | Digital distribution/answer key |
| F46 | Dashboard | User question/draft/review and taxonomy counts | Implemented | Signed-in users | Current work overview |
| F47 | Dashboard | Admin user/question/paper/audit totals | Implemented | Platform admins | Platform administration |
| F48 | Analytics | Paper results/student performance analytics | Not Implemented | — | Not found in current dashboard/data flows |
| F49 | Audit | Mutation audit records and authorized audit view | Implemented | Administrators | Accountability/operations |
| F50 | Email | Brevo/SMTP/console transport options | Implemented | System/users | Verification and account/invitation email |
| F51 | Rate limits | Memory and Redis/Upstash stores | Implemented | System/operator | Abuse protection / multi-instance support |
| F52 | Localization | Full application-wide locale/i18n framework | Not Implemented | — | Do not infer from bilingual question fields |

---

## 21. Implemented vs Incomplete

### Clearly Implemented

- Next.js App Router application with public pages, authentication screens, protected dashboard/admin areas, and corresponding APIs.
- Credentials authentication, optional Google OAuth, account verification, password recovery, profile management, and global/organization RBAC.
- Organization records, memberships, invitations, organization switching, teams, organization settings, and platform-level organization administration.
- Taxonomy and question bank with question lifecycle, filtering, exact/normalized duplicate checking, bulk import, and review operations.
- Ollama-backed AI question and creative-question draft generation with review/import flows.
- Creative questions represented as four linked question records sharing a stimulus and part metadata.
- Paper builder with manual and automatic question selection, admission subject allocation, saved question-pattern templates, question-use history options, paper lifecycle actions, similarity review, configurable design, printing, and PDF/DOCX exports.
- Admin/dashboard totals, audit logging, email provider options, and pluggable rate limiting.
- Unit, integration, and Playwright test files for significant domains and workflows.

### Incomplete / Unclear / Needs Verification

- **Organization data isolation is not a universal property of membership alone.** The org permission module explicitly separates capability grants from which organization's content is in scope. Many services are organization-aware and integration tests cover selected isolation cases, but a technical audit should verify every list/read/write/API path before describing isolation as universal.
- **Some UI/API permission paths differ.** In particular, the dashboard sidebar can expose the bulk-import link via a membership-aware permission helper while the import page checks the global `question:bulk-import` permission. Taxonomy pages similarly use membership-aware read access while some create controls test the global role. An admin sidebar can display an organizations link to a user who is then denied at the organizations page's narrower check. See `src/app/dashboard/layout.tsx`, `src/app/dashboard/questions/import/page.tsx`, taxonomy pages, `src/app/admin/layout.tsx`, and `src/app/admin/organizations/page.tsx`. These discrepancies should be verified/resolved before describing every navigation affordance as usable by every role.
- **Admission percentages describe question allocation, not a guaranteed marks distribution.** Availability/shortfalls exist; a specific percentage allocation cannot ensure an exact output if the eligible question pool is insufficient.
- **Question-level duplicate detection and paper similarity are different features.** The question-level path uses normalized content fingerprints; the paper-specific semantic review uses embeddings and an LLM. Do not attribute the 90% candidate threshold to question import/AI duplicate status.
- **Provider comments/config documentation are stale in places.** Active question generation uses Ollama; Gemini embeddings are used for paper similarities; Gemini JSON generation exists as a client method but no active application call site was found. Some comments/config/README still describe Gemini generation.
- **Paper version-history claims are stale/overstated.** The current paper model has lifecycle/clone provenance but no paper revision archive or rollback workflow. Comments in the current service/model explicitly distinguish clone provenance from versioning; a cleanup script is present. Do not describe a paper version history as implemented.
- **Public product pages are descriptive, not proof of the workflow itself.** Use the authenticated app pages/API/services for thesis claims, particularly for AI, admission, and exports.
- **PDF/DOCX design divergence:** PDF export can receive the current unsaved design from the UI; DOCX uses persisted design settings. Verify whether this is intended before describing both exports as identical previews.
- **Full analytics are not present in the inspected dashboards.** Current metrics are counts; paper performance/student results are not represented by an analytics workflow.
- **Full internationalization is not present.** Bengali/English question language and Bengali labels/output are implemented, but no complete app-wide locale framework was found.
- **Example-environment credential check:** the tracked `.env.example` contains a non-empty `OLLAMA_API_KEY` assignment. Its value is intentionally omitted from this report. Verify whether it is only a placeholder; if it is or was a live credential, remove it from the template/history as appropriate and rotate it.
- **Root documentation is partly out of date.** `README.md` says organization management, AI assistant/generation, and analytics are deliberately out of scope, but current source contains organization management and AI question features; it also describes new registration as `teacher`, while current source sets `DEFAULT_ROLE` to `member`. Reconcile those claims before relying on README as thesis evidence.
- **Historical test-results document is not current validation evidence.** `TEST_RESULTS.md` is dated 2026-08-09 and explicitly records prior test commands as not run in that environment. This audit did not run tests and does not reuse those results as current pass claims.

---

## 22. Current System Snapshot

AutoQgen is a Next.js/React question-bank and assessment-paper web application backed by MongoDB/Mongoose. It supports public informational pages; authenticated user accounts; global and organization-level roles; organizations, memberships, invitations, and teams; curriculum taxonomy; standard and creative question authoring; CSV/JSON import; Ollama-backed AI question generation; question review/approval; question duplicate fingerprints; and within-paper semantic similarity using Gemini embeddings plus Ollama validation.

Users can build papers manually or through automated selection of approved questions, including admission papers with multi-subject percentage allocation, and save reusable paper-pattern templates. The paper workflow includes draft/published/archived states, regeneration and cloning, live design/preview, browser printing, and student/teacher PDF/DOCX export. Dashboards expose question/taxonomy and platform-administration counts; the inspected system does not provide student-result analytics or a paper revision archive. Authentication is based on Auth.js/NextAuth; email is optionally delivered through Brevo or SMTP; rate limiting can use memory, Redis, or Upstash.

---

## 23. Evidence / Source References

The following route inventory covers the current API handler files. HTTP methods are grouped by route purpose; each handler's route file defines the exact methods and permissions.

| API route group | Implemented endpoint paths |
|---|---|
| Authentication | `/api/auth/[...nextauth]`, `/api/auth/register`, `/api/auth/verify-email`, `/api/auth/resend-verification`, `/api/auth/forgot-password`, `/api/auth/reset-password` |
| User account | `/api/users/me`, `/api/users/me/password`, `/api/users/me/avatar`, `/api/users/[id]/avatar` |
| Administration | `/api/admin/stats`, `/api/admin/settings`, `/api/admin/users`, `/api/admin/users/[id]`, `/api/admin/organizations`, `/api/admin/organizations/[id]`, `/api/admin/organizations/[id]/members`, `/api/admin/organizations/[id]/owner` |
| Taxonomy | `/api/categories`, `/api/categories/[id]`, `/api/subjects`, `/api/subjects/[id]`, `/api/chapters`, `/api/chapters/[id]`, `/api/topics`, `/api/topics/[id]`, `/api/boards`, `/api/boards/[id]`, `/api/exams`, `/api/exams/[id]` |
| Question bank and AI | `/api/questions`, `/api/questions/[id]`, `/api/questions/bulk`, `/api/questions/bulk-review`, `/api/questions/availability`, `/api/questions/ai-generate`, `/api/questions/ai-check`, `/api/questions/ai-import`, `/api/questions/ai-creative-generate`, `/api/questions/ai-creative-import`, `/api/questions/creative-group` |
| Papers | `/api/papers`, `/api/papers/generate`, `/api/papers/[id]`, `/api/papers/[id]/actions`, `/api/papers/[id]/design`, `/api/papers/[id]/regenerate`, `/api/papers/[id]/export`, `/api/papers/[id]/similarities`, `/api/papers/[id]/similarities/keep`, `/api/papers/[id]/similarities/replace` |
| Question-pattern templates | `/api/question-templates`, `/api/question-templates/[id]`, `/api/question-templates/[id]/duplicate` |
| Organization, invitations, teams | `/api/organization`, `/api/organization/switch`, `/api/organization/members`, `/api/organization/members/[id]`, `/api/organization/invitations`, `/api/organization/invitations/[id]`, `/api/organization/teams`, `/api/organization/teams/[id]`, `/api/organization/teams/[id]/members/[memberId]`, `/api/invitations`, `/api/invitations/[id]/accept`, `/api/invitations/[id]/reject` |
| Audit and health | `/api/audit`, `/api/health` |

The following source groups provide traceable evidence for the major feature areas documented above:

| Feature area | Primary source references |
|---|---|
| App routes and layouts | `src/app/`, especially `src/app/(auth)/`, `src/app/dashboard/`, `src/app/admin/`, `src/app/invitations/`, `src/app/platform/`, `src/app/resources/`, and `src/app/solutions/` |
| Navigation and UI | `src/components/dashboard/`, `src/components/admin/`, `src/components/auth/`, `src/components/organization/`, `src/components/questions/`, `src/components/review/`, `src/components/papers/`, `src/components/templates/` |
| Authentication, session, roles | `src/lib/auth/`, `src/types/roles.ts`, `src/types/organization.ts`, `src/middleware.ts`, `src/models/User.ts` |
| Organization/membership/team | `src/models/Organization.ts`, `OrganizationMember.ts`, `OrganizationInvitation.ts`, `Team.ts`; `src/lib/auth/org-session.ts`, `org-rbac.ts`; `src/lib/services/organization.service.ts`, `organization-member.service.ts`, `invitation.service.ts`, `team.service.ts` |
| Questions, creative groups, import/review | `src/models/Question.ts`, `src/lib/validation/question.schema.ts`, `src/lib/services/question.service.ts`, `src/lib/import/csv.ts`, `src/lib/services/ai-question.service.ts`, question/review components and `/api/questions/**` routes |
| AI and similarity | `src/lib/ai/question-generation-ollama.ts`, `question-prompt.ts`, `question-normalise.ts`, `gemini.ts`, `ollama.ts`; `src/lib/services/paper-similarity.service.ts`; `src/lib/similarity/`; `src/models/QuestionEmbedding.ts`, `PaperSimilarityReview.ts` |
| Papers, admission, templates | `src/models/QuestionPaper.ts`, `QuestionUsage.ts`, `QuestionPatternTemplate.ts`; `src/lib/validation/paper.schema.ts`, `question-template.schema.ts`; `src/lib/services/paper.service.ts`, `paper-generator.service.ts`, `question-template.service.ts`; `src/components/papers/`, `src/components/templates/` |
| Preview/export/print | `src/lib/export/paper-document.ts`, `pdf.ts`, `docx.ts`, `fonts.ts`; `src/lib/services/paper-export.service.ts`; `src/components/papers/PaperDetail.tsx`, `PaperPreview.tsx`, `DesignTab.tsx`; `src/app/globals.css` |
| Dashboards/admin/audit | `src/lib/services/dashboard.service.ts`, `src/app/dashboard/page.tsx`, `src/app/admin/page.tsx`, `src/app/admin/users/`, `src/app/admin/organizations/`, `src/app/admin/audit/`, `src/app/admin/settings/`, `src/lib/services/audit.service.ts`, `src/models/AuditLog.ts` |
| API surface and validation | `src/app/api/`, `src/lib/api/handler.ts`, `src/lib/api/response.ts`, `src/lib/validation/`, `src/lib/errors/` |
| Configuration and integrations | `.env.example` (variable names only; do not copy values), `src/lib/config/env.ts`, `src/lib/db/`, `src/lib/email/`, `src/lib/rate-limit/`, `src/lib/security/`, `package.json` |
| Tests | `tests/unit/`, `tests/integration/`, `tests/integration/README.md`, `e2e/auth.spec.ts`, `playwright.config.ts` |
| Seed/demo/maintenance scripts | `scripts/seed.ts`, `seed-demo.ts`, `seed-large.ts`, `migrate-organization-members.ts`, and other scripts under `scripts/` |
| Documentation cross-checks | `README.md`, `UPDATED_ARCHITECTURE.md`, `IMPLEMENTATION_SUMMARY.md`, `STEP1_CHANGELOG.md`, `STEP2_CHANGELOG.md`, `TEST_RESULTS.md`, `MANUAL_PAPER_CREATION_ALGORITHM.md` |

---

**End of Part 1 system discovery.** This report is a source inventory for subsequent thesis writing; code-level architecture, data-flow diagrams, detailed algorithms, threat analysis, and independent execution/coverage verification belong in later audit stages.
