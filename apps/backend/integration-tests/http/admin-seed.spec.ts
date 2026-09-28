import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import seed from "../../src/scripts/seed"

// spec FR-004a: local uses fixed credentials; any other APP_ENV requires
// ADMIN_EMAIL/ADMIN_PASSWORD and never creates the local admin.
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    describe("seed: admin user creation (FR-004a)", () => {
      const originalEnv = { ...process.env }

      afterEach(() => {
        process.env = { ...originalEnv }
      })

      it("creates the local admin when APP_ENV=local", async () => {
        const container = getContainer()
        process.env.APP_ENV = "local"
        delete process.env.ADMIN_EMAIL
        delete process.env.ADMIN_PASSWORD

        await seed({ container } as never)

        const userModuleService = container.resolve(Modules.USER)
        const users = await userModuleService.listUsers({
          email: "admin@lapalette.local",
        })
        expect(users).toHaveLength(1)
      })

      it("refuses to create a staging admin without credentials", async () => {
        const container = getContainer()
        process.env.APP_ENV = "staging"
        delete process.env.ADMIN_EMAIL
        delete process.env.ADMIN_PASSWORD

        await expect(seed({ container } as never)).rejects.toThrow(
          /ADMIN_EMAIL\/ADMIN_PASSWORD required/
        )

        const userModuleService = container.resolve(Modules.USER)
        const users = await userModuleService.listUsers({
          email: "admin@lapalette.local",
        })
        expect(users).toHaveLength(0)
      })

      it("creates the staging admin from ADMIN_EMAIL/ADMIN_PASSWORD", async () => {
        const container = getContainer()
        process.env.APP_ENV = "staging"
        process.env.ADMIN_EMAIL = "staging-admin@example.com"
        process.env.ADMIN_PASSWORD = "correct-horse-battery-staple"

        await seed({ container } as never)

        const userModuleService = container.resolve(Modules.USER)
        const staged = await userModuleService.listUsers({
          email: "staging-admin@example.com",
        })
        expect(staged).toHaveLength(1)

        const local = await userModuleService.listUsers({
          email: "admin@lapalette.local",
        })
        expect(local).toHaveLength(0)
      })
    })
  },
})

jest.setTimeout(300 * 1000)
