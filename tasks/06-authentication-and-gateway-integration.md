# Task 06: Authentication and Gateway Integration

## Priority
High

## Goal
Integrate OIDC login and JWT validation across frontend, Kong, and backend services so authenticated endpoints are protected while public game-read endpoints remain accessible.

## Depends On
- `01-domain-and-architecture-foundation.md`
- `02-wallet-service-core.md`
- `03-game-round-and-bet-engine.md`

## Scope
- Keycloak login flow in the frontend
- Token storage and refresh handling
- JWT validation in backend services
- Route protection by endpoint type
- Kong configuration updates if needed

## Authentication Requirements
- Login redirects to Keycloak using Authorization Code Flow with PKCE.
- Frontend handles callback and stores tokens safely for the chosen app style.
- Backend validates JWTs and extracts player identity.
- Public endpoints remain unauthenticated:
  - current round
  - round history
  - round verification
- Protected endpoints require valid JWT:
  - wallet creation
  - wallet me
  - bet placement
  - cashout
  - player bet history

## Identity Data Needed In Application Code
- stable user identifier from JWT subject claim
- preferred username or equivalent for UI display
- optional roles if you want admin-only features later

## Implementation Steps
1. Inspect the provided Keycloak realm configuration and client settings.
2. Pick a frontend auth library or implement the flow manually.
3. Add callback handling and protected-route logic.
4. Add NestJS JWT validation strategy in both services.
5. Normalize player identity extraction into a shared auth utility if useful.
6. Confirm Kong routes preserve auth headers correctly.

## Key Decisions
- Use `sub` as the stable player identifier.
- Display `preferred_username` when available.
- Keep auth concerns separated from game and wallet domain logic.

## Error Cases To Handle
- expired access token
- missing token on protected endpoints
- invalid audience or issuer
- user without an existing wallet

## Testing Plan
- Manual test:
  - login
  - callback
  - call protected endpoints
- Automated tests:
  - protected endpoint rejects unauthenticated request
  - valid JWT reaches controller with expected user context

## Acceptance Criteria
- The user can log in through Keycloak and reach the game page.
- Protected endpoints require valid JWTs.
- Backend code reads player identity from validated tokens only.
- Public routes work without authentication.
