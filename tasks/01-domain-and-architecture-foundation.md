# Task 01: Domain and Architecture Foundation

## Priority
Critical

## Goal
Define the core domain model, service boundaries, persistence strategy, and event contracts before implementing features. This task exists to prevent inconsistent business rules and accidental coupling between `games` and `wallets`.

## Why This Comes First
Most evaluation criteria depend on this work being solid:
- DDD and architecture carry the highest score weight.
- Messaging, tests, and the frontend all rely on stable domain behavior.
- A weak model here will create rework in every later task.

## Scope
- Define bounded contexts for `Game Service` and `Wallet Service`.
- Identify aggregates, entities, value objects, domain services, and repository interfaces.
- Define round lifecycle states and allowed transitions.
- Define wallet invariants and money representation.
- Define the async integration model between services.
- Decide where shared contracts live in `packages/`.

## Required Decisions
1. Money representation:
   - Use integer cents everywhere in application code and storage.
   - Expose formatted decimals only at API boundaries.
2. Aggregate boundaries:
   - `Round` should own round state transitions.
   - `Bet` should be tied to a specific round and player.
   - `Wallet` should own balance mutations.
3. Service responsibility split:
   - `games` decides gameplay and payout intent.
   - `wallets` is the only source of truth for balances.
4. Consistency model:
   - Use asynchronous events/messages for bet reservation/debit and cashout credit.
   - Define idempotency requirements up front.

## Suggested Domain Model

### Game Service
- `Round`
  - Fields: `id`, `status`, `crashPoint`, `serverSeedHash`, `serverSeed`, `startedAt`, `bettingClosesAt`, `crashedAt`, `crashMultiplier`
  - States: `BETTING_OPEN`, `IN_PROGRESS`, `CRASHED`, `SETTLED`
  - Invariants:
    - only one current round
    - no bets after betting closes
    - crash can happen only during `IN_PROGRESS`
- `Bet`
  - Fields: `id`, `roundId`, `playerId`, `stakeCents`, `status`, `cashoutMultiplier`, `payoutCents`, `placedAt`, `cashedOutAt`
  - States: `PENDING_FUNDS`, `CONFIRMED`, `CASHED_OUT`, `LOST`, `REJECTED`
  - Invariants:
    - one bet per player per round
    - no cashout after crash
    - payout derived only from server-side multiplier
- Value objects:
  - `Money`
  - `Multiplier`
  - `RoundId`, `PlayerId`, `BetId`

### Wallet Service
- `Wallet`
  - Fields: `id`, `playerId`, `balanceCents`, `currency`, `version`
  - Invariants:
    - balance never negative
    - only wallet service mutates balances
- `WalletTransaction`
  - Types: `INITIAL_CREDIT`, `BET_DEBIT`, `CASHOUT_CREDIT`, `COMPENSATION_CREDIT`
  - Must store external correlation identifiers for idempotency
- Value objects:
  - `Money`
  - `TransactionReference`

## Output Artifacts
- Domain model note or ADR in the repo
- Event contract definitions in a shared package
- Persistence schema draft for both services
- State diagrams for `Round` and `Bet`

## Implementation Steps
1. Inspect the current NestJS scaffold and keep the DDD folder split intact.
2. Create a short architecture decision record describing service ownership and consistency strategy.
3. Introduce shared contract types in `packages/` for message payloads and common primitives if needed.
4. Write down aggregate invariants before writing handlers or controllers.
5. Design database tables from domain needs rather than from endpoint shapes.
6. Validate that every required README endpoint can be traced back to an aggregate or query model.

## Risks To Control
- Putting business rules in controllers instead of domain/application layers
- Using floating-point values anywhere in money or payout calculations
- Allowing `games` to own wallet truth
- Designing messages too loosely, causing brittle integration later

## Acceptance Criteria
- Every core rule from the README maps to a domain invariant.
- Both services have clear ownership boundaries.
- Event names, payloads, and correlation identifiers are defined.
- The persistence model supports idempotency and auditability.
- Later tasks can implement features without redefining core concepts.

## Notes For Later Tasks
All later tasks should reuse this model. They may refine internal implementation details, but they should not redefine aggregate ownership or money semantics.
