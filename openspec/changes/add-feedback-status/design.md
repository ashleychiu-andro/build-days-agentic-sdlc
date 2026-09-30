# Design

## Context

Root `DESIGN.md` establishes the storage-interface boundary: shared contracts
do not depend on React, Express, or Azure SDK types; the API depends on a
`FeedbackStorage` port with in-memory and Azure Table adapters. This change
extends that existing seam rather than introducing a new boundary.

The `build-deployable-workshop` change already defines the `feedback-application`
capability (feedback board, voting, persistence, health, rate limiting). This
change adds one new requirement to that capability without altering the
existing requirements or their scenarios.

## Goals / Non-Goals

**Goals:**

- Give every feedback item an observable, board-visible status.
- Allow exactly one valid forward transition per request, enforced
  identically by the shared contract, the API, and the storage layer.
- Keep the change bounded to contract, storage, endpoint, and UI additions
  with no infrastructure or workflow impact.

**Non-Goals:**

- Production authentication or role-based access control.
- Status history, notifications, or bulk updates (see proposal Non-Goals).
- Any Bicep, Azure resource, or GitHub Actions workflow change.

## Decisions

### Transport: `PATCH /api/feedback/:id/status`

The endpoint uses `PATCH` because a status update is a partial modification of
an existing resource, distinct from the existing `POST` endpoints that create
new resources (`/api/feedback`) or append related records (`/api/feedback/:id/votes`).
Request body: `{ "status": FeedbackStatus }`.

**Alternative considered:** Reuse the `POST .../votes`-style convention for
consistency. Rejected because status change is idempotent-in-intent (one
target state per request) and semantically a partial update, which `PATCH`
communicates more accurately to API consumers and tests.

### No workshop authorization stand-in

The brief's "authorized workshop user" language is intentionally not
implemented as an authorization check. The existing application has no
authentication anywhere (feedback creation and voting are open to any client
with a generated `clientId`). Adding a status-specific authorization gate
would introduce an inconsistent, false sense of access control without a real
identity system behind it.

**Decision:** Any client may update status, identical to the existing
unauthenticated voting behavior. This is recorded here as an explicit,
reviewed deviation from the brief's literal wording, not an overlooked
requirement. A production deployment of this pattern would need a real
authorization layer, which is out of scope for this workshop sample.

### Forward-only validation lives in the shared contract

The allowed transition (`new` -> `planned` -> `done`) is validated once in
`src/shared/contracts.ts` so the Express endpoint and any future client-side
pre-check use the same source of truth. `contracts.ts` exports the ordered
status list and a pure transition-validation function; it does not import
Express or Azure types, preserving the existing dependency direction.

### Two distinct failure paths: `VALIDATION_ERROR` vs `INVALID_TRANSITION`

A malformed request body (missing or unrecognized `status` value) is a
schema-level failure and reuses the existing `VALIDATION_ERROR` code and
`fieldErrors` shape produced by `validateBody`. A well-formed but
out-of-sequence status (skip, reverse, resubmit, or any change from a
terminal `done` state) is a business-rule failure and uses a new
`INVALID_TRANSITION` code with an HTTP 409 response, since the request is
valid but conflicts with the resource's current state.

### Storage: reuse the vote transaction/retry pattern

`AzureTableFeedbackStorage.updateStatus` reads the entity, validates the
transition against the freshly read current status, and submits an
`update`/`Replace` transaction with the same optimistic-concurrency retry loop
used by `vote` (handling `412` by retrying, `409` by treating the entity state
as authoritative). `InMemoryFeedbackStorage.updateStatus` performs the same
validation synchronously against its in-memory map.

**Alternative considered:** Validate the transition only in the Express layer
before calling storage. Rejected because the storage layer must independently
guard against a stale read racing a concurrent update, mirroring how `vote`
already guards vote-count consistency.

## Risks / Trade-offs

- **No authorization** means any workshop participant or observer with
  network access to the app can change any item's status. Acceptable for a
  four-hour workshop sample with no sensitive data; called out explicitly so
  it is never mistaken for a production pattern.
- **Terminal-state rejection** (no transitions once `done`) slightly narrows
  the brief's literal "move forward" language into "move forward until
  terminal." This is the only interpretation consistent with a three-value
  forward-only sequence and is recorded here rather than left implicit.

## Migration and Rollback

No data migration is required; `status` is additive to existing Azure Table
entities and defaults to `new` only for newly created items. Existing seeded
items (`seedStorage` in `storage.ts`) gain an explicit `status: "new"` value.
Rollback removes the new endpoint, storage method, and UI control without
affecting existing feedback or vote data, since no existing field is renamed
or removed.

## Durable Architecture Impact

None. This change uses the existing storage-interface and shared-contract
boundaries defined in root `DESIGN.md` and does not introduce a new
architectural boundary or require a root `DESIGN.md` update.
