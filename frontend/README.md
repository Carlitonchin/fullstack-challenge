# Frontend

React + TypeScript + Vite frontend for the crash game client.

## Validation

Use these commands to validate the production build locally:

```bash
cd frontend
bun run typecheck
bun run build
```

`bun run build` runs `tsc -b && vite build` and is the production build gate for this app.

## UI Components

To add components to the app, run:

```bash
npx shadcn@latest add button
```
