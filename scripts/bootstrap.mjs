#!/usr/bin/env node
// One-time local setup (FR-002c): copy env templates, check the database is
// configured, run migrations and seed. See
// specs/001-project-skeleton/contracts/dev-commands.md.
import { existsSync, copyFileSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")

function copyIfMissing(from, to, label) {
  if (existsSync(to)) {
    console.log(`✓ ${label} already exists, keeping it.`)
    return
  }
  copyFileSync(from, to)
  console.log(`✓ Created ${label} from its template.`)
}

copyIfMissing(
  path.join(root, "apps/backend/.env.template"),
  path.join(root, "apps/backend/.env"),
  "apps/backend/.env"
)
copyIfMissing(
  path.join(root, "apps/storefront/.env.template"),
  path.join(root, "apps/storefront/.env.local"),
  "apps/storefront/.env.local"
)

const backendEnv = readFileSync(path.join(root, "apps/backend/.env"), "utf8")
const databaseUrl = backendEnv.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim()

if (!databaseUrl) {
  console.error(
    "\nSet DATABASE_URL in apps/backend/.env (Railway dev Postgres) before running pnpm bootstrap again.\n"
  )
  process.exit(1)
}

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`)
  const result = spawnSync(command, args, { stdio: "inherit", cwd: root })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run("pnpm", ["db:migrate"])
run("pnpm", ["seed"])

console.log(
  "\nCopy the printed \"Storefront publishable key\" into " +
    "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY in apps/storefront/.env.local.\n"
)
