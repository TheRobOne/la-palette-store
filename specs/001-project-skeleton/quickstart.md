# Quickstart & Validation: Project Skeleton

Commands: [contracts/dev-commands.md](contracts/dev-commands.md). Variables:
[contracts/configuration.md](contracts/configuration.md).

## Prerequisites

- Node.js 24 LTS, `corepack enable` (pnpm 12)
- Internet access; the Railway **dev** Postgres URL in `apps/backend/.env`
- No Docker, no Redis

## V1 — Local environment (US1, SC-001, SC-002)

```bash
pnpm install
pnpm bootstrap
pnpm dev
```

Expected:
- `http://localhost:9000/health` → `OK`; `/status` → `200`, `checks.database = "ok"`
- `http://localhost:9000/app` → Admin login
- `http://localhost:8000/pl` → brand shell + ≥ 6 "(test)" products with gross PLN prices
- `pnpm dev` → all responding in < 2 min

Negative checks:
- `pnpm seed` twice → no duplicates
- Empty `DATABASE_URL` → startup stops naming `DATABASE_URL`
- Wrong/unreachable DB host → fails within 30 s with "database cannot be reached"
- Backend stopped → storefront shows "Sklep jest chwilowo niedostępny"

## V2 — Admin for Poland (US2)

1. Log in at `/app` as `admin@lapalette.local` / `lapalette-local`.
2. Region "Polska", PLN, tax PL 8%, prices tax-inclusive.
3. Change a "(test)" product price → storefront shows the new gross price.

## V3 — Brand shell (US3)

1. `/pl` at 360 px → no horizontal scroll, usable menu.
2. Logo, beige/brown palette, Instrument Serif + Switzer match lapalettegarden.pl.
3. Change `--color-beige-light` in the single theme file → every page changes.
4. Footer → `/pl/regulamin`, `/pl/polityka-prywatnosci` placeholders; all shell text Polish.

## V4 — Checks (US4, SC-003, SC-004)

```bash
pnpm lint && pnpm typecheck && pnpm test:unit && pnpm build   # = CI, < 5 min
pnpm test:integration                                          # local, dev DB server
pnpm test:e2e                                                  # local, apps running
```

Expected: all green; e2e reports 0 axe WCAG 2.2 AA violations; after integration tests no
`medusa-*-integration-*` databases remain on the dev server and dev data is unchanged.
On GitHub: PR with a deliberate type error → CI red; revert → green.

## V5 — Staging (FR-011a, SC-003a)

Requires GitHub remote + Railway project (research R-02, R-11).

1. Merge to `main` → CI green → Railway deploys automatically, live < 15 min.
2. Staging `/status` → `200`; storefront lists seeded products.
3. `admin@lapalette.local` login fails on staging; `ADMIN_EMAIL`/`ADMIN_PASSWORD` works.
4. `curl -I` storefront → `X-Robots-Tag: noindex, nofollow`; `/robots.txt` disallows all.
5. Failing CI → staging keeps the previous version.
6. Manual Lighthouse (mobile) on staging `/pl` → LCP ≤ 2.5 s, CLS ≤ 0.1.
