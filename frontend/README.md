# Frontend

React + Vite + TypeScript + Tailwind CSS v4 + shadcn-style UI + TanStack Query + Zustand.

## Commands (pnpm only)

```bash
pnpm install
pnpm dev
pnpm build
pnpm preview
```

## Env

```env
VITE_API_BASE_URL=http://localhost:8000
```

## Structure

- `src/features/chat` — chat page
- `src/components/ui` — shadcn-style primitives
- `src/lib/api.ts` — API client
- `src/stores/chatStore.ts` — session + messages (persisted)
