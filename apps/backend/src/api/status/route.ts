import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const CHECK_TIMEOUT_MS = 500

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

/**
 * Readiness check (FR-010, contracts/http-api.md): unlike the built-in
 * `/health` liveness check, this reports whether the database is reachable.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  let database: "ok" | "error" = "ok"
  try {
    await withTimeout(
      query.graph({ entity: "store", fields: ["id"], pagination: { take: 1 } }),
      CHECK_TIMEOUT_MS
    )
  } catch {
    database = "error"
  }

  const status = database === "ok" ? "ok" : "degraded"
  const httpStatus = status === "ok" ? 200 : 503

  res.status(httpStatus).json({
    status,
    version: process.env.npm_package_version ?? "0.1.0",
    environment: process.env.APP_ENV ?? "local",
    checks: { database },
  })
}
