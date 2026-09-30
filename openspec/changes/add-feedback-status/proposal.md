# Proposal

## Why

Workshop users need to distinguish new feedback from items that are being
considered or completed, without editing the original request. The feedback
board currently has no state model beyond category and vote count, so teams
cannot signal triage progress on an item.

## What Changes

- Add an optional `status` field to the shared feedback contract with exactly
  three values: `new`, `planned`, `done`. New feedback always starts as `new`.
- Add a strict forward-only transition rule (`new` -> `planned` -> `done`).
  Skipping, reversing, or resubmitting the same status is rejected with a
  dedicated `INVALID_TRANSITION` error and does not mutate stored data.
- Add `updateStatus` to the `FeedbackStorage` interface and implement it in
  both the in-memory test adapter and the Azure Table Storage adapter, reusing
  the existing optimistic-concurrency retry pattern used by voting.
- Add a `PATCH /api/feedback/:id/status` Express endpoint that validates the
  request body, maps `FeedbackNotFoundError` to 404, and maps an invalid
  transition to a 409 `INVALID_TRANSITION` response.
- Add a status badge and a forward-only status control to the React board,
  with an accessible label reflecting the current status and next action, a
  per-item loading state, and user-visible error messaging for rejected
  transitions.
- Preserve existing feedback creation, voting, persistence, health, and
  readiness behavior unchanged.

This change has no required participant authentication. The workshop sample
does not implement production authentication anywhere; the status control is
therefore available to any client, consistent with the existing voting
behavior. This is a documented workshop-only limitation, not a production
authorization model.

## Capabilities

### Modified Capabilities

- `feedback-application`: Adds an observable feedback status requirement
  (display, valid transition, invalid transition rejection, unknown-ID
  rejection) while preserving all existing feedback and voting requirements.

## Non-Goals

- Custom status values beyond `new`, `planned`, and `done`.
- Role-based access control or any production authentication/authorization.
- Status change history or an audit trail.
- Notifications on status change.
- Bulk status updates across multiple items.
- Any infrastructure, Bicep, or workflow change.

## Impact

- **Application:** Shared contract, Express API, and React UI each gain a
  bounded, testable addition; no existing feedback or voting behavior changes.
- **Tests:** New contract, storage, API, and UI test cases map directly to the
  five required scenarios below.
- **Infrastructure:** None. Azure Table Storage already supports adding a new
  entity property; no schema migration workflow exists or is needed.
- **Security:** No new credential, permission, or identity surface. The
  explicit lack of an authorization stand-in is a called-out non-goal, not an
  oversight.
- **Documentation:** This proposal, its capability delta, design, and tasks
  are the durable record of the workshop-only authorization decision.
