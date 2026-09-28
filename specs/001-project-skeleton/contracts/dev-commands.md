# Contract: Repository commands (FR-001, FR-002c, FR-011, FR-013)

Run from the repository root. Each command MUST exit non-zero on failure. Only Node 24 and
pnpm (via Corepack) are required locally.

| Command | Behaviour | Runs in CI |
|---|---|---|
| `pnpm install` | Installs both workspaces | yes (`--frozen-lockfile`) |
| `pnpm bootstrap` | One-time: copies `.env.template` → `.env` where missing, checks `DATABASE_URL` is set, runs migrations + seed (named `bootstrap` because `setup` is a pnpm built-in) | no |
| `pnpm dev` | Backend on `:9000` (Admin `/app`) and storefront on `:8000` in parallel | no |
| `pnpm seed` | Idempotent seed (safe to re-run) | no |
| `pnpm db:migrate` | Medusa migrations incl. `catering` module | no |
| `pnpm lint` | ESLint in both apps | yes |
| `pnpm typecheck` | `tsc --noEmit` in both apps | yes |
| `pnpm test:unit` | Backend Jest unit tests + storefront `node --test` | yes |
| `pnpm build` | Production builds of both apps | yes |
| `pnpm test:integration` | Backend integration tests on a temporary DB on the dev Postgres server (created and dropped by Medusa's runner) | no — local, before merging critical-path changes |
| `pnpm test:e2e` | Playwright smoke + axe audit against running local apps | no — local |

Local development = 3 commands after cloning: `pnpm install`, `pnpm bootstrap`, `pnpm dev`.

## Storefront routes (UI contract)

| Route | Content |
|---|---|
| `/` | Redirects to `/pl` (starter country routing) |
| `/pl` | Brand hero, product grid from backend, header, footer |
| `/pl/regulamin` | Placeholder terms page |
| `/pl/polityka-prywatnosci` | Placeholder privacy page |
| `/robots.txt` | `Disallow: /` when `ALLOW_INDEXING=false` |
| backend-down state | "Sklep jest chwilowo niedostępny", header/footer still rendered |
