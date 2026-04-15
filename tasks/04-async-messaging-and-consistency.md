# Task 04: Async Messaging and Consistency

## Priority
Critical

## Goal
Make `games` and `wallets` communicate reliably through RabbitMQ or the chosen broker, with explicit contracts, idempotency, and compensation behavior where required. This task is central to the challenge because it proves the system can survive real distributed conditions.

## Depends On
- `01-domain-and-architecture-foundation.md`
- `02-wallet-service-core.md`
- `03-game-round-and-bet-engine.md`

## Scope
- Broker setup and module wiring
- Shared event/message contracts
- Publishing and consuming bet and cashout flows
- Correlation IDs and idempotency keys
- Retry strategy and dead-letter approach
- Failure recovery and compensation decisions

## Event Contract Set

### Bet Flow
- `bet.debit.requested`
- `bet.debit.succeeded`
- `bet.debit.failed`

### Cashout Flow
- `cashout.credit.requested`
- `cashout.credit.succeeded`
- `cashout.credit.failed`

## Message Fields To Standardize
- `eventId`
- `eventType`
- `occurredAt`
- `correlationId`
- `causationId`
- `playerId`
- `roundId`
- `betId`
- money fields in integer cents
- version number for payload evolution

## Minimum Reliability Requirements
- Consumers must be idempotent.
- Publishers must produce traceable correlation identifiers.
- Duplicate delivery must not duplicate balance changes or bet resolution.
- A message failure must be observable and recoverable.

## Recommended Strategy
- Keep initial implementation pragmatic:
  - at-least-once delivery
  - idempotent consumers
  - persisted transaction/reference IDs
- If time allows, add transactional outbox in both services as a bonus-level enhancement.

## Failure Scenarios To Design For
- `games` publishes debit request twice
- `wallets` processes a debit and crashes before ack
- `games` receives duplicate success events
- credit succeeds but acknowledgement is retried
- broker temporarily unavailable during a state transition

## Compensation Guidance
- Failed debit:
  - mark bet as `REJECTED`
  - no further action
- Failed cashout credit:
  - keep cashout state traceable
  - retry until the wallet credit is confirmed
  - do not silently lose a player payout

## Implementation Steps
1. Create a shared contracts package for broker payloads.
2. Set explicit exchange, queue, and routing key conventions.
3. Implement publishers in application services, not controllers.
4. Implement consumers with idempotent transaction/reference checks.
5. Add structured logging for message publish/consume/result paths.
6. Add retry and dead-letter policy where the chosen library supports it.
7. Document message flow in the project README or ADRs.

## Testing Plan
- Integration tests for broker round-trips
- Duplicate delivery tests
- Failure simulation for debit rejection
- Failure simulation for delayed credit confirmation

## Acceptance Criteria
- Bet and cashout workflows are fully asynchronous between services.
- Duplicate broker messages do not corrupt balances or bet states.
- Correlation IDs allow tracing a full operation end to end.
- The system has a documented strategy for retries and irrecoverable failures.
