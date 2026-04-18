# Frontend

React + TypeScript + Vite client for the crash game UI.

## Docker Runtime

`bun run docker:up` builds this app with [`frontend/Dockerfile`](/Users/carlos/Documents/projects/fullstack-challenge/frontend/Dockerfile) and serves the production bundle at `http://localhost:3000`.

The container bakes these Vite variables into the production build:

- `VITE_API_BASE_URL` default: `http://localhost:8000`
- `VITE_KEYCLOAK_BASE_URL` default: `http://localhost:8080`
- `VITE_KEYCLOAK_REALM` default: `crash-game`
- `VITE_KEYCLOAK_CLIENT_ID` default: `crash-game-client`
- `VITE_KEYCLOAK_REDIRECT_URI` default: `http://localhost:3000/auth/callback`

Those defaults match the Docker Compose stack and the imported Keycloak realm, so the UI talks to the backend only through Kong and keeps the OIDC callback on the frontend origin.

## Local Validation

Use these commands to validate the production build locally:

```bash
cd frontend
bun run typecheck
bun run build
```

`bun run build` runs `tsc -b && vite build` and is the production build gate for this app.
