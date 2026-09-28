import { defineConfig } from "@playwright/test"

// Local only (research R-10): run against apps already started with
// `pnpm dev` — no webServer auto-start, so it never needs the dev database
// from CI.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8000",
  },
  reporter: [["list"]],
})
