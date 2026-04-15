# Task 10: Testing, Hardening, and Delivery

## Priority
Critical

## Goal
Close the challenge with the mandatory test coverage, Docker reliability, documentation, and delivery quality expected by the README. This task converts a working prototype into a submission-ready project.

## Depends On
- `02-wallet-service-core.md`
- `03-game-round-and-bet-engine.md`
- `04-async-messaging-and-consistency.md`
- `05-provably-fair-system.md`
- `06-authentication-and-gateway-integration.md`
- `07-realtime-websocket-and-sync.md`
- `08-frontend-foundation-and-auth-flow.md`
- `09-game-ui-and-player-experience.md`

## Scope
- Unit tests
- API and broker integration tests
- End-to-end happy paths
- Docker Compose reliability
- Setup documentation
- Final submission polish

## Mandatory Test Matrix

### Unit Tests
- round lifecycle transitions
- bet validation and state transitions
- payout calculation
- wallet debit and credit behavior
- insufficient balance handling
- provably fair determinism and verification

### API / E2E Tests
- place bet, round progresses, cashout succeeds, wallet updates
- place bet, round crashes, bet is lost
- duplicate bet rejected
- bet rejected on insufficient funds
- bet rejected during active round

## Delivery Reliability Checklist
- `bun install` works from repo root
- `bun run docker:up` starts everything without manual intervention
- migrations run automatically
- Keycloak realm is imported automatically
- Kong routing works for public and protected endpoints
- frontend is included in Compose once implemented

## Documentation Checklist
- setup instructions
- architecture summary
- event flow explanation
- provably fair explanation
- chosen trade-offs and known limitations
- test instructions
- seeded test user credentials and wallet expectations

## Hardening Targets
- structured logging around bet and cashout flows
- graceful handling of service startup ordering
- clear error responses from APIs
- stable startup scripts in containers

## Implementation Steps
1. Add missing unit tests for all core domain rules.
2. Add e2e coverage for the required gameplay flows.
3. Verify broker-driven workflows under Docker.
4. Integrate the frontend container into `docker-compose.yml`.
5. Ensure services run migrations or bootstrap automatically.
6. Update the project README for reviewers.
7. Run a full submission rehearsal from a clean environment.

## Submission Quality Guidance
- Keep commits atomic and logically grouped.
- Prefer one clear path that works reliably over multiple half-finished features.
- If some bonus feature is added, make sure it does not weaken the required core flow.

## Acceptance Criteria
- All eliminatory requirements in the README are satisfied.
- The project is reproducible from a clean machine with the documented commands.
- Tests cover both happy paths and critical failure paths.
- The repository is ready to present and defend in a technical interview.
