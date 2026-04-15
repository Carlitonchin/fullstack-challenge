# Task 03: Game Round and Bet Engine

## Priority
Critical

## Goal
Implement the gameplay core in `games`: round creation, betting window, crash execution, and bet lifecycle management. This task should produce a deterministic server-authoritative round engine with clear state transitions.

## Depends On
- `01-domain-and-architecture-foundation.md`

## Scope
- Current round management
- Historical rounds
- Bet placement rules
- Cashout rules
- Round scheduling and state transitions
- REST endpoints for rounds and bets

## Deliverables
- Round and Bet persistence models
- Round scheduler or loop
- REST endpoints:
  - `GET /games/rounds/current`
  - `GET /games/rounds/history`
  - `GET /games/bets/me`
  - `POST /games/bet`
  - `POST /games/bet/cashout`
- Unit tests for round and bet rules

## Core State Machines

### Round
- `BETTING_OPEN`
- `IN_PROGRESS`
- `CRASHED`
- `SETTLED`

### Bet
- `PENDING_FUNDS`
- `CONFIRMED`
- `CASHED_OUT`
- `LOST`
- `REJECTED`

## Functional Requirements
- Exactly one active round should exist at any time.
- Betting is accepted only while the round is in `BETTING_OPEN`.
- A player can place only one bet per round.
- New bets start as `PENDING_FUNDS` until wallet confirmation arrives.
- Cashout is allowed only for confirmed bets while the round is `IN_PROGRESS` and before crash.
- If a player does not cash out before crash, the bet becomes `LOST`.

## Round Engine Design
- Use a server-side scheduler, not client timing.
- Create the next round as soon as the previous one is settled.
- Persist timestamps needed for replay and frontend synchronization:
  - betting open time
  - betting close time
  - round start time
  - crash time
- Keep the crash point predetermined before betting starts.

## Bet Placement Flow
1. Validate authentication and request payload.
2. Read current round and verify `BETTING_OPEN`.
3. Check if player already has a bet in the round.
4. Create bet as `PENDING_FUNDS`.
5. Publish debit request to wallet service.
6. Return accepted/pending status to the client.
7. When debit success arrives, mark bet as `CONFIRMED`.
8. When debit failure arrives, mark bet as `REJECTED`.

## Cashout Flow
1. Validate authenticated player.
2. Load current round and the player's confirmed bet.
3. Compute current multiplier from authoritative server time.
4. Reject if current multiplier is already past the crash point.
5. Mark the bet as cashed out with frozen multiplier and payout.
6. Publish wallet credit request.
7. Return cashout result immediately with the locked payout.

## Implementation Steps
1. Add tables for rounds and bets with uniqueness constraints.
2. Implement domain methods for round transitions.
3. Implement domain methods for placing and cashing out bets.
4. Add a background process inside the game service for round lifecycle control.
5. Add query endpoints for current round, history, and player bets.
6. Store enough metadata to support later verification and WebSocket replay.

## Race Conditions To Resolve
- Wallet success arrives after betting closes
- Cashout request arrives near crash time
- Duplicate debit success/failure messages
- Service restart during active round

## Testing Plan
- Unit tests:
  - valid round transitions
  - invalid round transitions
  - one bet per user per round
  - cashout allowed only before crash
  - payout calculation at locked multiplier
- E2E or integration:
  - place bet during open window
  - reject bet during active round
  - lose bet on crash without cashout

## Acceptance Criteria
- The game service owns round state and bet state correctly.
- All round/bet transitions are enforced server-side.
- REST API matches the README requirements.
- Betting and cashout are resilient to duplicate or delayed external messages.
- Round history and current round views are queryable at any moment.
