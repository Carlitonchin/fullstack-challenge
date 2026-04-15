# AGENTS.md

This file defines the project-specific rules for any AI agent working in this repository. Follow these instructions strictly. The goal is not just to make the code work, but to deliver a strong full-stack challenge submission that is internally consistent, testable, and defensible in a technical interview.

## Mission

Build a production-style crash game challenge with:

- `games` service as the game engine and round authority
- `wallets` service as the monetary authority
- asynchronous inter-service communication via broker
- server-to-client real-time synchronization via WebSocket
- OIDC/JWT authentication
- Docker-first local setup with no manual steps
- tests for domain logic and end-to-end flows

The challenge is evaluated on architecture, domain modeling, correctness, real-time behavior, monetary precision, and code quality. Optimize for those areas first.

## Absolute Rules

- Never use floating-point arithmetic for money.
- Never make `games` the source of truth for wallet balances.
- Never replace the async `games` <-> `wallets` communication with direct synchronous HTTP for critical money flows.
- Never make the client authoritative for game state, round timing, crash point, or payouts.
- Never send player actions through WebSocket if REST is sufficient. The challenge explicitly expects REST for actions and WebSocket for server push.
- Never break `bun run docker:up`. All required services must boot without manual configuration.
- Never add undocumented shortcuts that would be hard to justify in an interview.
- Never silently weaken domain invariants to make tests easier.

## Current Repository Reality

At the moment, this repository contains:

- infra scaffolding in `docker-compose.yml`
- Kong, Keycloak, PostgreSQL, and RabbitMQ setup
- minimal NestJS scaffolding for `services/games` and `services/wallets`
- some domain work may already exist and must be reviewed before adding new code

There is not yet a full implementation of:

- persistence
- broker workflows
- wallet domain
- bet domain
- application use cases
- frontend
- auth integration
- tests beyond scaffolding

Do not write code as if these pieces already exist. Build from the current state of the repo.

## Source of Truth by Bounded Context

### Games Service

Owns:

- round lifecycle
- betting window state
- crash progression and settlement rules
- provably fair generation and verification data
- current round snapshot
- round history
- bet placement rules
- cashout eligibility and payout calculation
- WebSocket broadcast events

Does not own:

- persisted wallet balance
- wallet debit/credit authority

### Wallets Service

Owns:

- wallet creation
- current balance
- debit/credit operations
- transaction history and idempotency for money movements

Does not own:

- round timing
- crash outcome
- payout formula

## Existing Domain Contract: Round Aggregate

Treat domain aggregates as the source of truth for business rules. In this project that will typically include concepts such as:

- `Round`
- `Bet`
- `Wallet`

When implementing or extending domain behavior:

- review existing aggregates and entities before adding new abstractions
- preserve and extend domain models instead of bypassing them from controllers or repositories
- add behavior to an aggregate only when the rule truly belongs to that aggregate
- keep persistence concerns out of aggregates
- keep transport DTOs out of aggregates
- do not mutate aggregate state from controllers or repositories

Any important domain invariant should live close to the domain model that owns it and should be backed by tests.

## Money and Precision Rules

- Represent money in minor units such as integer cents, or use a safe decimal strategy at the persistence boundary.
- If the public API accepts decimal strings like `"10.50"`, parse them into a safe money representation immediately.
- Never use JavaScript `number` for wallet balance arithmetic.
- Never allow negative balances.
- Enforce min/max bet limits exactly:
  - minimum: `1.00`
  - maximum: `1000.00`

Recommended approach:

- use integer cents in domain and application layers
- use `BIGINT` or `NUMERIC` in the database
- keep formatting logic at the presentation layer

## Required Interaction Model

### Player Actions

Use REST for:

- create wallet
- fetch own wallet
- place bet
- cash out
- fetch own bet history

### Real-Time Updates

Use WebSocket only for server push:

- betting window opened
- betting window closed
- round started
- multiplier updates or timing reference updates
- bet accepted and visible to other players
- cashout broadcast
- crash event
- round settlement / verification data publication

Do not design the frontend around client-generated round progression. The server is authoritative.

## Inter-Service Communication Rules

`games` and `wallets` must communicate asynchronously through the broker for monetary operations.

Minimum flows to support:

- bet requested -> wallet debit requested -> wallet debit confirmed/rejected
- cashout requested -> payout credit requested -> wallet credit confirmed/rejected
- failure path requiring compensation or refund when needed

Every money-related message should be designed with:

- idempotency key
- correlation or causation id
- clear status semantics
- retry-safe handling

If you implement outbox/inbox, prefer that. If not, still design handlers as at-least-once delivery safe.

## Concurrency and Race Conditions

Assume these cases will be tested or discussed:

- duplicate bet request
- bet arrives after betting window closes
- cashout arrives exactly around crash time
- broker message redelivery
- repeated wallet credit/debit event
- multiple browser tabs connected at once

Required posture:

- make commands idempotent where possible
- use persistence constraints to back domain rules
- make terminal state transitions explicit
- do not rely only on frontend button disabling for safety

## Authentication Rules

Auth is part of the challenge even if full user management is not.

- backend must validate JWTs
- user identity should come from the token, not request body
- frontend should use OIDC authorization code flow with PKCE
- use the preconfigured Keycloak realm unless there is a strong reason to replace it

Do not build custom auth when the repo already includes Keycloak scaffolding.

## Frontend Rules

The frontend should feel like a real game client, not an admin panel.

Must include:

- login flow
- current round status
- visible countdown for betting
- animated multiplier / crash visualization
- bet form with validation
- cashout control with potential payout visibility
- current round bets list in real time
- round history
- wallet balance and username
- loading and error states
- mobile and desktop support

Frontend state guidance:

- TanStack Query for server state
- local store or context for ephemeral UI state
- WebSocket event reconciliation must be deterministic
- if client interpolation is used for smoother multiplier animation, it must still anchor to server timestamps/state

## Testing Requirements

Tests are mandatory, not optional polish.

At minimum, cover:

- `Round` lifecycle and invalid transitions
- bet validation and cashout rules
- wallet debit/credit and insufficient balance
- provably fair deterministic verification
- end-to-end happy path: bet -> round progresses -> cashout -> wallet updated
- end-to-end failure path: bet -> crash -> loss recorded
- validation failures: insufficient balance, duplicate bet, late bet

Prefer:

- unit tests at the domain layer
- integration tests around handlers/use cases
- e2e tests through HTTP and broker-backed flows

Do not leave core invariants untested.

## Folder and Layering Discipline

Keep the intended DDD separation:

- `domain/`: entities, aggregates, value objects, domain services, repository contracts
- `application/`: use cases, commands, handlers, orchestrators, event mapping
- `infrastructure/`: ORM, broker adapters, persistence implementations, external integrations
- `presentation/`: controllers, gateways, DTOs, serializers

Rules:

- controllers should orchestrate, not contain business rules
- repositories should not contain transport concerns
- DTO validation is not a substitute for domain invariants
- avoid leaking ORM entities into domain types

## Provably Fair Guidance

This feature is evaluated directly. Treat it as first-class functionality.

The implementation should let a player verify that:

- the crash point was predetermined
- the published pre-round hash matches the revealed seed
- the crash calculation for a historical round is deterministic

Recommended deliverables:

- pre-round public hash
- post-round seed reveal
- verification endpoint per round
- isolated pure function tests for the formula

Do not hide the algorithm in controller code. Keep it explicit and testable.

## Delivery and Interview Readiness

Everything added should be easy to explain in an interview.

Prefer:

- simple, explicit flows over overly clever abstractions
- small commits with clear intent
- well-named types and events
- architecture notes in the final README

Be prepared to justify:

- why async communication was modeled that way
- how duplicate messages are handled
- how cashout vs crash races are resolved
- why money handling is safe
- how provably fair works
- why the frontend stays synchronized

## Practical Working Checklist

Before finishing any substantial implementation, verify:

- the code respects the existing domain aggregates instead of bypassing them
- money never uses floating-point arithmetic
- cross-service money flows are async and idempotent
- backend rejects invalid actions even if the UI allows them accidentally
- WebSocket only broadcasts server-authoritative state
- the docker setup still boots cleanly
- tests were added for the new rules
- the final behavior is explainable without hand-waving

## What “Perfect” Means in This Repo

For this challenge, “perfect” does not mean maximum complexity. It means:

- correct domain rules
- clean boundaries
- reliable money handling
- realistic real-time behavior
- deterministic verification logic
- reproducible local setup
- meaningful tests
- code that the human owner can defend confidently

If forced to choose, prefer correctness, clarity, and interview-defensible trade-offs over extra features.
