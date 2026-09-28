import { loadEnv, defineConfig, MedusaError } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// FR-009 / US1 scenario 4: fail fast with the name of any missing required
// variable instead of a confusing downstream error.
const REQUIRED_ENV_VARS = [
  'APP_ENV',
  'DATABASE_URL',
  'MEDUSA_BACKEND_URL',
  'STORE_CORS',
  'ADMIN_CORS',
  'AUTH_CORS',
  'JWT_SECRET',
  'COOKIE_SECRET',
]

for (const name of REQUIRED_ENV_VARS) {
  if (!process.env[name]) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Missing required environment variable: ${name}`
    )
  }
}

const isProduction = process.env.APP_ENV === 'production'

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: {
      // Railway Postgres uses a self-signed certificate; only relax
      // verification outside production (research R-02).
      connection: isProduction
        ? undefined
        : { ssl: { rejectUnauthorized: false } },
      pool: {
        // Fail fast with a clear error instead of hanging when the Railway
        // dev database is unreachable (spec: Edge Cases).
        acquireTimeoutMillis: 30_000,
      },
    },
    workerMode:
      (process.env.MEDUSA_WORKER_MODE as 'shared' | 'worker' | 'server') ||
      'shared',
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
  },
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === 'true',
  },
  // Constitution: Redis only in production; local dev and staging use
  // Medusa's built-in in-memory event bus, workflow engine, locking and
  // cache, so no modules are registered for them here.
  modules: [
    {
      resolve: './src/modules/catering',
    },
  ],
})
