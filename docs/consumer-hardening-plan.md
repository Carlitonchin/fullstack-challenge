# AMQP Consumer Hardening Plan

## Objective

Harden the RabbitMQ consumers used by `games` and `wallets` so they:

- limit in-flight work with `prefetch`
- stop infinite requeue loops for poison messages
- send poison messages to a DLQ instead of retrying forever
- distinguish between poison errors and transient/retriable errors
- reconnect automatically after RabbitMQ connection/channel loss

This plan is intentionally scoped to consumer hardening only. It does not try to redesign business flows, outbox publishing, or game/wallet domain rules.

## Why This Matters

Today the project already has:

- durable queues
- durable exchanges
- outbox on the producer side
- idempotency keys in money-flow events

But the consumer side is still fragile in four ways:

1. Consumers do not call `channel.prefetch(...)`, so in-flight work is effectively unbounded.
2. Any exception ends in `nack(..., requeue=true)`, which creates infinite retry loops for malformed or impossible messages.
3. Consumers connect only once during module init and do not reconnect after RabbitMQ restarts.
4. There is no dead-letter topology for isolating poison messages.

In an interview, fixing this improves the story significantly:

- "Producers are outbox-safe and consumers are at-least-once but bounded."
- "Poison messages are isolated, not retried forever."
- "Transient infrastructure failures retry; bad payloads go to DLQ."
- "Consumers self-heal after broker restarts."

## Current State

### Current Consumers

There are three consumer implementations:

1. `services/wallets/src/infrastructure/messaging/games-money-flow.consumer.ts`
   Queue: `wallets.money-flow`
   Exchange: `games.domain`
   Routing keys:
   - `bet.debit.requested`
   - `bet.refund.requested`
   - `cashout.credit.requested`

2. `services/games/src/infrastructure/messaging/wallet-events.consumer.ts`
   Queue: `games.wallet-events`
   Exchange: `wallets.domain`
   Routing keys:
   - `bet.debit.succeeded`
   - `bet.debit.failed`
   - `bet.refund.succeeded`
   - `bet.refund.failed`
   - `cashout.credit.succeeded`
   - `cashout.credit.failed`

3. `services/games/src/infrastructure/messaging/player-realtime-events.consumer.ts`
   Queues:
   - `games.player-realtime.wallet-events`
   - `games.player-realtime.bet-events`
   Exchanges:
   - `wallets.domain`
   - `games.domain`
   Routing keys:
   - wallet queue: `wallet.credited`, `wallet.debited`
   - bet queue: `bet.rejected`

### Where the Current Problems Are

#### No prefetch

The current consumers call `channel.consume(...)` directly without `channel.prefetch(...)`.

Relevant files:

- `services/wallets/src/infrastructure/messaging/games-money-flow.consumer.ts`
- `services/games/src/infrastructure/messaging/wallet-events.consumer.ts`
- `services/games/src/infrastructure/messaging/player-realtime-events.consumer.ts`

#### Infinite requeue on all failures

All consumers currently do:

- `ack` on success
- `nack(message, false, true)` on any exception

That means:

- malformed JSON is retried forever
- unsupported event types are retried forever
- deterministic handler bugs are retried forever
- transient DB errors and poison payloads are treated the same

#### No reconnect loop

The consumers establish one AMQP connection and one channel in `onModuleInit()`. If RabbitMQ restarts later, there is no recovery loop to recreate:

- connection
- channel
- exchanges
- queues
- bindings
- active consumers

For contrast, the publisher already has close/error handling in `packages/messaging/src/amqp-broker.publisher.ts`. That file is a useful reference for connection/channel lifecycle handling.

## Constraints and Important Context

### Queue mutation trap

This is the most important operational caveat in this plan:

- RabbitMQ durable queues cannot be re-declared with different arguments.
- If we add `x-dead-letter-exchange` or `x-dead-letter-routing-key` to an existing queue with the same name, RabbitMQ will fail with `PRECONDITION_FAILED`.

Because this repository uses a persistent RabbitMQ volume in `docker-compose.yml`, this matters even in local development.

For this project, do not version queue names. The project is still in development and there is no production queue compatibility requirement.

Keep the existing main queue names:

- `wallets.money-flow`
- `games.wallet-events`
- `games.player-realtime.wallet-events`
- `games.player-realtime.bet-events`

Use matching DLQ names:

- `wallets.money-flow.dlq`
- `games.wallet-events.dlq`
- `games.player-realtime.wallet-events.dlq`
- `games.player-realtime.bet-events.dlq`

If the implementer sees `PRECONDITION_FAILED` locally after adding DLQ arguments, reset the local RabbitMQ volume with:

```bash
bun run docker:down
docker volume rm fullstack-challenge_rabbitmq_data
bun run docker:up
```

If the Docker Compose project name differs, inspect the actual volume name with `docker volume ls`.

### Scope boundary

This plan should not introduce:

- database migrations
- synchronous HTTP fallback between services
- changes to outbox semantics
- frontend changes
- domain model redesign

If new dependencies are needed, remember repository policy:

- do not edit `package.json` manually
- use `bun add ...`

That said, this work can likely be done without new dependencies.

## Target Design

## 1. Add explicit dead-letter topology

### Recommendation

Create one shared dead-letter exchange for consumers:

- exchange name: `consumer.dead-letter`
- exchange type: `topic`
- durable: `true`

For each main queue:

- declare the main queue with:
  - `deadLetterExchange: "consumer.dead-letter"`
  - `deadLetterRoutingKey: "<main-queue-name>"`
- declare a dedicated DLQ queue
- bind the DLQ queue to `consumer.dead-letter` using the main queue name as routing key

Example mapping:

- main queue: `wallets.money-flow`
- DL routing key: `wallets.money-flow`
- DLQ queue: `wallets.money-flow.dlq`

### Why one shared DLX is enough

This keeps topology simple:

- one DLX to assert
- one DLQ per main queue
- easy inspection in RabbitMQ UI
- no per-consumer exchange sprawl

## 2. Add bounded concurrency with prefetch

### Recommendation

Set `channel.prefetch(...)` before `consume(...)`.

Use conservative defaults first:

- `wallets.money-flow`: prefetch `4`
- `games.wallet-events`: prefetch `8`
- `games.player-realtime.*`: prefetch `16`

Rationale:

- money flow is transactional and more sensitive to contention
- wallet-events in `games` are lighter, but still mutate state
- realtime consumers are cheaper and mostly projection-like

If the implementer wants lower scope, a single default prefetch value is acceptable as long as it is finite and explicit.

Suggested env vars only if needed:

- `AMQP_CONSUMER_PREFETCH_MONEY_FLOW`
- `AMQP_CONSUMER_PREFETCH_WALLET_EVENTS`
- `AMQP_CONSUMER_PREFETCH_REALTIME`

Do not add config sprawl unless tuning is actually necessary.

## 3. Introduce explicit error classification

### Required outcome

The consumer loop must decide between:

- `ack`
- `nack(requeue=true)`
- `nack(requeue=false)` so RabbitMQ dead-letters the message

### Recommended classification model

Use three categories:

1. `ack/no-op`
   For messages that are valid but no longer need work.

2. `retriable`
   For transient infrastructure or persistence failures.

3. `poison`
   For malformed, unsupported, or deterministic failures that will not succeed on retry.

### Classification matrix

#### Ack / no-op

These should be acknowledged normally:

- duplicate/idempotent redelivery that the handler already absorbed
- out-of-order-but-safe events that the handler intentionally ignores
- missing local entity when the code already defines it as benign no-op

Examples already present:

- `games` wallet event handlers often return early if bet/round is already resolved
- `player-realtime` skips missing rejected bet lookup

These should remain `ack`, not DLQ.

#### Retriable

These should use `nack(..., false, true)`:

- database connectivity failures
- transaction startup failures
- RabbitMQ channel/connection errors during handler work
- temporary repository failures
- temporary ORM/runtime failures that are clearly infrastructure-related

#### Poison

These should use `nack(..., false, false)` so the broker routes them to DLQ:

- invalid JSON in `message.content`
- envelope missing required fields
- unsupported `eventType` for a bound queue
- structurally valid message with impossible payload shape
- deterministic business-invariant failure that will never succeed on retry

Examples:

- `JSON.parse(...)` throws
- event type does not match any supported branch
- a handler throws because the message is semantically impossible, not because infra is temporarily unavailable

### Important implementation detail

Do not rely only on parsing generic `Error.message` strings.

Introduce explicit typed errors, ideally in a shared place, for example:

- `PoisonMessageError`
- `RetriableConsumerError`

If modifying handlers is acceptable, make service-layer handlers throw a typed poison error for deterministic failures. That is much safer than trying to infer intent from generic `ConflictException` or `InternalServerErrorException`.

If scope must stay smaller, implement classification first in the consumer with these rules:

- `SyntaxError` from `JSON.parse` => poison
- unknown `eventType` => poison
- everything else => retriable

That smaller version is still a clear improvement.

## 4. Add reconnection lifecycle

### Required behavior

If RabbitMQ connection or channel closes after boot:

- consumer must log the event
- release stale in-memory references
- schedule reconnect with backoff
- recreate connection and channel
- re-assert exchanges, queues, bindings, prefetch, and `consume(...)`

### Minimum lifecycle states

Each consumer should track:

- `stopped`
- `connection`
- `channel`
- `reconnectTimer`
- `isStarting` or equivalent guard

### Reconnect rules

- do not run multiple reconnect loops in parallel
- do not reconnect after `onModuleDestroy()`
- always recreate topology after reconnect
- always re-register `channel.consume(...)` after reconnect

### Backoff recommendation

Use exponential backoff with cap:

- start: `1000ms`
- cap: `30000ms`

That is enough for this repo. No need for more elaborate jitter logic unless the implementer wants it.

## 5. Prefer a shared helper instead of three custom reconnection loops

### Recommendation

Extract shared consumer connection logic into a reusable helper, likely under `packages/messaging`.

Candidate file:

- `packages/messaging/src/resilient-amqp-consumer.ts`

Suggested responsibilities:

- connect to RabbitMQ
- create channel
- register close/error listeners
- apply prefetch
- assert exchanges/queues/bindings
- start consuming
- reconnect with backoff
- stop cleanly on shutdown

Each service consumer should then provide only:

- topology definition
- message handler
- classification function

### Why shared helper is worth it

Without it, the same reconnect and classification skeleton will be duplicated three times.

With it:

- lower maintenance cost
- consistent logs
- consistent retry policy
- easier testability

If the implementer decides not to extract a shared helper in the first iteration, that is acceptable, but the reconnect logic must stay structurally identical across the three consumers.

## Proposed Implementation Sequence

## Phase 1: Introduce common concepts

### Files likely to add

- `packages/messaging/src/resilient-amqp-consumer.ts`
- `packages/messaging/src/consumer-errors.ts`
- `packages/messaging/src/consumer-topology.ts`

### Deliverables

- typed poison/retriable error helpers
- queue/DLX declaration helpers
- reconnect loop abstraction

## Phase 2: Harden `wallets.money-flow`

### File

- `services/wallets/src/infrastructure/messaging/games-money-flow.consumer.ts`

### Why start here

This is the most critical queue because it applies money-side effects.

### Required changes

- add DLX and DLQ assertions
- add explicit prefetch
- replace one-shot connect with resilient connect/reconnect
- classify malformed/unsupported messages as poison
- requeue only transient failures

### Handler-specific guidance

The handler already contains business-level idempotency and failure responses. Preserve that.

Do not change these semantics:

- missing wallet emits failure event and acks
- insufficient balance emits failure event and acks
- duplicate operation is absorbed

Only harden transport/consumer behavior around it.

## Phase 3: Harden `games.wallet-events`

### File

- `services/games/src/infrastructure/messaging/wallet-events.consumer.ts`

### Required changes

- DLX + DLQ
- prefetch
- reconnect
- classification

### Handler-specific guidance

Keep no-op/idempotent early returns as `ack`.

If any handler throws a deterministic state error that will never recover on retry, prefer converting that path to a typed poison error so the message goes to DLQ instead of looping forever.

## Phase 4: Harden `games.player-realtime`

### File

- `services/games/src/infrastructure/messaging/player-realtime-events.consumer.ts`

### Required changes

- DLX + DLQ for both queues
- prefetch
- reconnect
- classification

### Special note

This class currently consumes two different queues on one channel.

Two acceptable implementations:

1. Keep one connection and one channel, but re-register both consumers on reconnect.
2. Preferable if still simple: one connection and one channel per queue.

Option 2 is easier to reason about if the helper assumes one queue per consumer instance, but either is acceptable.

## Detailed Error Handling Policy

## Parsing stage

When receiving `ConsumeMessage`:

1. If `message` is `null`, return immediately.
2. Parse `message.content`.
3. If parsing fails, log at `error` or `warn` level and `nack(requeue=false)`.
4. If parsed envelope has missing core fields, `nack(requeue=false)`.

Core fields to validate at minimum:

- `eventType`
- `occurredAt`
- `data`
- `metadata`

If the implementer wants stronger validation, add per-event lightweight type guards. A full schema library is optional, not required.

## Routing stage

If a queue receives an event type it does not support:

- treat as poison
- `nack(requeue=false)`

Do not just warn and requeue forever.

## Handler stage

If the handler finishes successfully:

- `ack`

If the handler intentionally treats the event as benign no-op:

- `ack`

If the handler throws a typed poison error:

- `nack(requeue=false)`

If the handler throws an untyped/infrastructure error:

- `nack(requeue=true)`

## Logging Policy

Use different log messages for:

- poison message dead-lettered
- transient failure requeued
- connection closed
- reconnect scheduled
- reconnect succeeded

This matters because today logs do not distinguish “bad message” from “temporary outage”.

Suggested log examples:

- `Dead-lettering poison message on wallets.money-flow: invalid JSON`
- `Requeueing transient failure on games.wallet-events: database unavailable`
- `AMQP consumer connection closed for games.wallet-events; reconnecting in 2000ms`
- `AMQP consumer reconnected for games.wallet-events`

## Queue Topology Proposal

## Main exchanges

Keep existing exchanges:

- `games.domain`
- `wallets.domain`

## New exchange

- `consumer.dead-letter`

## Main queues and DLQs

- `wallets.money-flow`
- `wallets.money-flow.dlq`
- `games.wallet-events`
- `games.wallet-events.dlq`
- `games.player-realtime.wallet-events`
- `games.player-realtime.wallet-events.dlq`
- `games.player-realtime.bet-events`
- `games.player-realtime.bet-events.dlq`

## Main queue declaration args

Each main queue should include:

- `durable: true`
- `deadLetterExchange: "consumer.dead-letter"`
- `deadLetterRoutingKey: "<main-queue-name>"`

## DLQ queue declaration

Each DLQ queue should be:

- durable
- bound to `consumer.dead-letter`
- bound with routing key equal to the main queue name

## Reconnect Implementation Notes

## Suggested consumer skeleton

At a high level, each consumer should do this:

1. `onModuleInit()` calls `start()`.
2. `start()` connects and configures topology if not already starting/stopped.
3. Register:
   - `connection.on("close", ...)`
   - `connection.on("error", ...)`
   - `channel.on("close", ...)`
   - `channel.on("error", ...)`
4. Call `channel.prefetch(...)`.
5. Assert exchange(s), queue(s), DLX, DLQ(s), binding(s).
6. Call `channel.consume(...)`.
7. On close:
   - clear references
   - schedule reconnect if not stopped
8. `onModuleDestroy()`:
   - mark `stopped=true`
   - clear timers
   - close channel/connection

## Important safety guards

- guard against duplicate `start()` calls
- guard against duplicate reconnect timers
- clear stale channel/connection references before reconnect
- do not reconnect after explicit shutdown

## Test Plan

## Unit-level tests

Add focused tests for the new helper and classification logic.

Suggested coverage:

- `prefetch` is applied before consuming
- invalid JSON is classified as poison
- unsupported `eventType` is classified as poison
- typed poison handler error becomes `nack(requeue=false)`
- generic transient error becomes `nack(requeue=true)`
- reconnect is scheduled when connection closes
- reconnect does not run after shutdown

These tests can be done with mocked `amqplib` primitives or an extracted adapter interface.

## Integration / behavior tests

At least one integration-style test per hardened behavior should exist.

Suggested scenarios:

1. Poison message reaches DLQ
   - publish invalid JSON to a queue
   - assert it is absent from main queue and present in DLQ

2. Transient error is retried
   - force the handler to throw a retriable error once
   - assert the message is reprocessed successfully later

3. Reconnect after broker restart
   - start stack
   - stop RabbitMQ briefly
   - restart RabbitMQ
   - assert consumer resumes processing without service restart

If full automation is too expensive for the first pass, at minimum document these manual verification steps and add unit tests for the reconnect helper.

## Acceptance Criteria

The work is complete when all of the following are true:

- every AMQP consumer has explicit finite prefetch
- every AMQP consumer reconnects automatically after broker loss
- malformed JSON does not loop forever
- unsupported event types do not loop forever
- poison messages land in a DLQ
- transient errors still retry
- benign no-op/idempotent deliveries still ack cleanly
- queue declarations do not break existing local environments
- logs clearly distinguish dead-letter vs requeue vs reconnect

## Recommended Minimal Deliverable

If time is tight, ship this minimum:

1. shared DLX + per-queue DLQ using the existing queue names
2. prefetch
3. reconnect loop
4. poison classification only for:
   - invalid JSON
   - unsupported event type
5. everything else remains retriable

That version is still a strong interview improvement and much safer than the current behavior.

## Recommended Better Deliverable

If there is room for one more step, add typed poison errors from handler code for deterministic failures. That removes guesswork from consumer classification and makes the design easier to explain.

## Files Expected to Change

Very likely:

- `services/wallets/src/infrastructure/messaging/games-money-flow.consumer.ts`
- `services/games/src/infrastructure/messaging/wallet-events.consumer.ts`
- `services/games/src/infrastructure/messaging/player-realtime-events.consumer.ts`
- `packages/messaging/src/amqp-broker.publisher.ts`
  - only if the implementer wants to reuse patterns or extract shared connection logic
- `packages/messaging/src/index.ts`
  - if new helper exports are added

Possibly:

- `packages/messaging/src/runtime-config.ts`
  - if consumer config is added there
- `docker-compose.yml`
  - only if the implementer decides to expose extra consumer tuning env vars

## Final Notes for the Implementer

- Keep this change operationally focused. Do not expand scope into domain redesign.
- Keep the current queue names; this project is still in development and local RabbitMQ data can be reset if queue arguments conflict.
- Prefer explicit typed errors over string inspection when classifying failures.
- Treat `player-realtime` as important too; losing live projection reliability weakens the real-time story of the challenge.
- Reuse the publisher lifecycle approach as inspiration, but do not copy it blindly because consumers need topology recreation and `consume(...)` re-registration on reconnect.
