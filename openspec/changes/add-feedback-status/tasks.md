# Tasks

## 1. Shared status contract and storage

- [ ] 1.1 Add `feedbackStatuses` (`new`, `planned`, `done`), `FeedbackStatus`
  type, a pure forward-only transition validator, and an `updateStatusSchema`
  to `src/shared/contracts.ts`. Add `status: FeedbackStatus` to the `Feedback`
  interface.
- [ ] 1.2 Add `updateStatus(id, status)` to the `FeedbackStorage` interface in
  `src/server/storage.ts`. Implement it in `InMemoryFeedbackStorage`
  (synchronous transition validation against the in-memory map) and in
  `AzureTableFeedbackStorage` (read-validate-transact with the existing
  vote-style optimistic-concurrency retry loop). Add a dedicated
  `InvalidTransitionError` class alongside `FeedbackNotFoundError`. Update
  `toFeedback`, `create`, and `seedItems`/`seedStorage` to set/carry
  `status: "new"` by default.
- [ ] 1.3 Add test cases to `tests/contracts.test.ts` (transition validator:
  valid forward step, skip, reverse, same-status, terminal-state input) and
  to `tests/storage.test.ts` (new item defaults to `new`; valid transition
  persists; invalid transition rejected and unchanged; unknown ID rejected;
  vote count/dedup unaffected by a status update) for both storage adapters
  where the existing test file already exercises both.
- [ ] 1.4 Validate with `npx vitest run tests/contracts.test.ts tests/storage.test.ts`
  and report the real result.

## 2. Express endpoint and React UI

- [ ] 2.1 Add `PATCH /api/feedback/:id/status` to `src/server/app.ts` using
  the existing `validateBody(updateStatusSchema)` pattern; map
  `FeedbackNotFoundError` to the existing 404 `NOT_FOUND` response and the new
  `InvalidTransitionError` to a 409 response with `ApiError.code =
  "INVALID_TRANSITION"`.
- [ ] 2.2 Add `updateFeedbackStatus` to `src/client/api.ts` following the
  existing `request<T>` pattern used by `voteForFeedback`.
- [ ] 2.3 Add a status badge and a forward-only status control to each
  feedback card in `src/client/App.tsx`, following the existing `votingId`
  per-item loading-state pattern; disable/hide the control at `done`; surface
  `INVALID_TRANSITION` and not-found errors through the existing
  `aria-live="polite"` error region; give the control an explicit
  `aria-label` reflecting the current status and the next action.
- [ ] 2.4 Add test cases to `tests/api.test.ts` (valid transition returns 200
  with updated status; invalid transition returns 409 `INVALID_TRANSITION`;
  malformed body returns 400 `VALIDATION_ERROR`; unknown ID returns 404) and
  to `tests/App.test.tsx` (status badge renders; control advances status on
  click; control is disabled/absent at `done`; error message renders on a
  rejected transition).
- [ ] 2.5 Validate with `npx vitest run tests/api.test.ts tests/App.test.tsx`
  and report the real result. This task depends on Task 1's tests passing
  first, since the endpoint and UI both call the storage/contract additions
  from Task 1.

## 3. Evidence and documentation

- [ ] 3.1 Run `npm run check` and record the full result.
- [ ] 3.2 Confirm every capability scenario in
  `openspec/changes/add-feedback-status/specs/feedback-application/spec.md`
  maps to at least one test added in Tasks 1-2; note the mapping in the
  implementation pull request description.
- [ ] 3.3 Validate with `openspec validate add-feedback-status --strict` and
  report the real result.
