# Tasks

## 1. Shared status contract and storage

- [x] 1.1 Add `feedbackStatuses` (`new`, `planned`, `done`), `FeedbackStatus`
  type, a pure forward-only transition validator, and an `updateStatusSchema`
  to `src/shared/contracts.ts`. Add `status: FeedbackStatus` to the `Feedback`
  interface.
- [x] 1.2 Add `updateStatus(id, status)` to the `FeedbackStorage` interface in
  `src/server/storage.ts`. Implement it in `InMemoryFeedbackStorage`
  (synchronous transition validation against the in-memory map) and in
  `AzureTableFeedbackStorage` (read-validate-transact with the existing
  vote-style optimistic-concurrency retry loop). Add a dedicated
  `InvalidTransitionError` class alongside `FeedbackNotFoundError`. Update
  `toFeedback`, `create`, and `seedItems`/`seedStorage` to set/carry
  `status: "new"` by default.
- [x] 1.3 Add test cases to `tests/contracts.test.ts` (transition validator:
  valid forward step, skip, reverse, same-status, terminal-state input) and
  to `tests/storage.test.ts` (new item defaults to `new`; valid transition
  persists; invalid transition rejected and unchanged; unknown ID rejected;
  vote count/dedup unaffected by a status update) for both storage adapters
  where the existing test file already exercises both.
- [x] 1.4 Validate with `npx vitest run tests/contracts.test.ts tests/storage.test.ts`
  and report the real result. **Result: 23 passed (23), 2 test files.**

## 2. Express endpoint and React UI

- [x] 2.1 Add `PATCH /api/feedback/:id/status` to `src/server/app.ts` using
  the existing `validateBody(updateStatusSchema)` pattern; map
  `FeedbackNotFoundError` to the existing 404 `NOT_FOUND` response and the new
  `InvalidTransitionError` to a 409 response with `ApiError.code =
  "INVALID_TRANSITION"`.
- [x] 2.2 Add `updateFeedbackStatus` to `src/client/api.ts` following the
  existing `request<T>` pattern used by `voteForFeedback`.
- [x] 2.3 Add a status badge and a forward-only status control to each
  feedback card in `src/client/App.tsx`, following the existing `votingId`
  per-item loading-state pattern; disable/hide the control at `done`; surface
  `INVALID_TRANSITION` and not-found errors through the existing
  `aria-live="polite"` error region; give the control an explicit
  `aria-label` reflecting the current status and the next action.
- [x] 2.4 Add test cases to `tests/api.test.ts` (valid transition returns 200
  with updated status; invalid transition returns 409 `INVALID_TRANSITION`;
  malformed body returns 400 `VALIDATION_ERROR`; unknown ID returns 404) and
  to `tests/App.test.tsx` (status badge renders; control advances status on
  click; control is disabled/absent at `done`; error message renders on a
  rejected transition).
- [x] 2.5 Validate with `npx vitest run tests/api.test.ts tests/App.test.tsx`
  and report the real result. This task depends on Task 1's tests passing
  first, since the endpoint and UI both call the storage/contract additions
  from Task 1. **Result: 19 passed (19), 2 test files.**

## 3. Evidence and documentation

- [x] 3.1 Run `npm run check` and record the full result. **Result:**
  `lint` passed; `typecheck` passed (both `tsc --noEmit` and
  `tsc -p tsconfig.server.json --noEmit`); `test` reported 59/70 passed with
  11 pre-existing, unrelated failures in `tests/workshop-scripts.test.ts`
  (missing `pwsh`/`bash` executables on this machine — confirmed identical on
  `main` via `git stash`, not caused by this change); `build` (run
  separately since `test` short-circuited `&&`) succeeded, producing
  `dist/client` and `dist/server`. Re-running the full suite excluding that
  unrelated file: `npx vitest run --exclude "**/workshop-scripts.test.ts"` →
  **60 passed (60), 6 test files.**
- [x] 3.2 Confirm every capability scenario in
  `openspec/changes/add-feedback-status/specs/feedback-application/spec.md`
  maps to at least one test added in Tasks 1-2; note the mapping in the
  implementation pull request description. **Mapping:**
  - New feedback starts as `new` → `tests/api.test.ts` "advances feedback
    status through valid transitions"; `tests/storage.test.ts` "creates new
    feedback with status new".
  - Status is visible in the feedback list → `tests/api.test.ts` "creates,
    lists, and votes on feedback" (asserts `list.body.items[0].status`).
  - A valid forward transition persists → `tests/api.test.ts` "advances
    feedback status through valid transitions" (asserts the PATCH response
    and a follow-up list read); `tests/storage.test.ts` "persists a valid
    forward status transition" and "persists a valid status transition via
    updateEntity" (Azure adapter).
  - An invalid transition is rejected → `tests/api.test.ts` "rejects an
    invalid status transition without changing the stored status";
    `tests/contracts.test.ts` skip/reverse/resubmit cases;
    `tests/storage.test.ts` "rejects an invalid status transition without
    changing state" and "rejects an invalid Azure status transition without
    calling updateEntity".
  - A terminal item rejects further updates → `tests/api.test.ts` "rejects
    any further status change once an item is done"; `tests/contracts.test.ts`
    terminal-state case.
  - A malformed status request is rejected → `tests/api.test.ts` "returns
    actionable validation for a malformed status body without changing the
    stored status".
  - An unknown feedback identifier is rejected → `tests/api.test.ts`
    "returns a not-found response for status updates on missing feedback";
    `tests/storage.test.ts` "rejects a status update for an unknown feedback
    identifier" and "reports a missing feedback identifier without calling
    updateEntity" (Azure adapter).
  - Existing voting behavior is unaffected → `tests/storage.test.ts` "leaves
    vote count and dedup unaffected by a status update".
  - UI: status badge, forward control, and error surfacing →
    `tests/App.test.tsx` "renders a status badge and an advance control for
    a new item", "hides the advance control once an item reaches done",
    "advances status on click and shows a confirmation", "shows an error
    message when a status transition is rejected".
- [x] 3.3 Validate with `openspec validate add-feedback-status --strict` and
  report the real result. **Result: "Change 'add-feedback-status' is
  valid".**
