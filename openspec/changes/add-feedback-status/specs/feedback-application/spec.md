## ADDED Requirements

### Requirement: Feedback status

The application SHALL let a workshop user view the status of feedback and
SHALL let an authorized workshop client move an item forward through exactly
three ordered states: `new`, `planned`, `done`. The application SHALL reject
any transition that is not the single next state in that order, and SHALL
reject a status update for an unknown feedback identifier.

#### Scenario: New feedback starts as `new`

- **WHEN** a workshop user submits valid feedback
- **THEN** the created item is persisted and returned with status `new`

#### Scenario: Status is visible in the feedback list

- **WHEN** a client requests the feedback list
- **THEN** every returned item includes its current status

#### Scenario: A valid forward transition persists

- **WHEN** a client requests the single next status for an existing item
  (`new` to `planned`, or `planned` to `done`)
- **THEN** the new status is persisted and is returned by both the status
  update response and a subsequent feedback list request after a refresh

#### Scenario: An invalid transition is rejected

- **WHEN** a client requests a status that is not the single next state,
  including skipping a state, reversing to an earlier state, or resubmitting
  the current state
- **THEN** the application rejects the request with an `INVALID_TRANSITION`
  error and the stored status remains unchanged

#### Scenario: A terminal item rejects further updates

- **WHEN** a client requests any status change for an item whose status is
  already `done`
- **THEN** the application rejects the request with an `INVALID_TRANSITION`
  error and the stored status remains `done`

#### Scenario: A malformed status request is rejected

- **WHEN** a client submits a status update with a missing or unrecognized
  status value
- **THEN** the application rejects the request with a validation error
  identifying the invalid field, distinct from an `INVALID_TRANSITION` error,
  and does not change the stored status

#### Scenario: An unknown feedback identifier is rejected

- **WHEN** a client requests a status update for a feedback identifier that
  does not exist
- **THEN** the application rejects the request without creating or modifying
  any feedback data

#### Scenario: Existing voting behavior is unaffected

- **WHEN** a status update is applied to a feedback item
- **THEN** the item's vote count and vote-deduplication behavior are unchanged
