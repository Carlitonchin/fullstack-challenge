# Task 08: Frontend Foundation and Auth Flow

## Priority
High

## Goal
Create the frontend scaffold and core application shell, including routing, auth integration, API clients, state management, and the basic game page layout.

## Depends On
- `06-authentication-and-gateway-integration.md`
- `07-realtime-websocket-and-sync.md`

## Scope
- Frontend framework setup
- Tailwind and component system setup
- Auth callback/login flow
- Shared API and socket clients
- Global app state and query setup
- Responsive page shell

## Framework Recommendation
- Vite + React if speed and simplicity are the priority
- TanStack Start if you want stronger alignment with the company stack
- Next.js only if you can keep the solution simple and avoid SSR complexity

## Core Deliverables
- `frontend/` scaffold with scripts and Dockerfile
- Tailwind CSS v4 setup
- Query client and app providers
- Auth-aware routing
- API client with token injection
- Socket client with reconnect support
- Main game layout with placeholder sections wired to real data sources

## UI Sections To Prepare
- header with username and wallet balance
- crash chart area
- bet controls panel
- current bets list
- round history strip
- error/toast system

## State Ownership Plan
- Server state:
  - current round
  - history
  - player bets
  - wallet
  - use TanStack Query
- Client state:
  - auth session
  - optimistic UI flags if any
  - local animation state
  - use Zustand or Context

## Implementation Steps
1. Choose the frontend framework and scaffold the app.
2. Configure Tailwind, base theme tokens, and shadcn/ui if used.
3. Implement login redirect and callback handling.
4. Create shared HTTP and WebSocket clients targeting Kong.
5. Build route guards and session bootstrap logic.
6. Build the main page skeleton with responsive layout containers.

## UX Expectations
- Dark casino-inspired visual language
- Clear CTA states for login, bet, and cashout
- Useful empty/loading/error states
- Mobile-friendly layout without hiding core functionality

## Acceptance Criteria
- The frontend runs locally and can be added to `docker-compose`.
- Login flow works against the provided Keycloak realm.
- The main game page loads real data from backend endpoints.
- The app shell is stable enough for detailed feature work in the next task.
