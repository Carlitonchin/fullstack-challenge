# Task 07: Realtime WebSocket and Sync

## Priority
High

## Goal
Provide a server-push channel that keeps all connected clients synchronized with round lifecycle changes, multiplier progress, bets, and cashouts in near real time.

## Depends On
- `03-game-round-and-bet-engine.md`
- `04-async-messaging-and-consistency.md`
- `05-provably-fair-system.md`

## Scope
- WebSocket gateway in `games`
- Event schema for clients
- Initial state synchronization on connect
- Broadcast strategy for round lifecycle and bet updates
- Reconnect handling

## Constraint
Player actions are still performed via REST. WebSocket is outbound only from server to clients.

## Event Set Suggestion
- `round.snapshot`
- `round.bettingOpened`
- `round.started`
- `round.multiplierTick`
- `round.crashed`
- `bet.placed`
- `bet.confirmed`
- `bet.rejected`
- `bet.cashedOut`

## Payload Design Principles
- Include `serverTime` or authoritative timestamps.
- Include `roundId` on every round-related event.
- Keep payloads small and versionable.
- Avoid leaking secrets such as unrevealed seeds.

## Synchronization Strategy
- On connect:
  - emit a full snapshot of current round and visible bets
- During the round:
  - send authoritative timestamps so the client can animate between updates
  - optionally broadcast ticks at a manageable interval instead of every frame
- On reconnect:
  - client requests or receives a fresh snapshot

## Implementation Steps
1. Add a WebSocket gateway in the game service.
2. Define DTOs for outbound events.
3. Emit events from application services or domain event handlers.
4. Broadcast current round snapshot to new connections.
5. Decide tick interval and interpolation strategy for multiplier updates.
6. Add disconnect/reconnect resilience in the frontend contract.

## Performance Guidance
- Do not broadcast excessive per-frame events if interpolation can reduce traffic.
- Keep multiplier calculation server-authoritative even if the client animates between ticks.
- Use stable ordering for public bet list updates.

## Testing Plan
- Multi-tab manual verification
- Automated tests for event emission on:
  - round start
  - crash
  - bet placement
  - cashout

## Acceptance Criteria
- Two or more clients see the same round progress and crash outcome.
- New clients can join mid-round and synchronize correctly.
- WebSocket payloads provide enough data for the frontend to render real-time state.
- REST remains the only write path for player actions.
