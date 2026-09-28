import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

// quickstart.md V4: opens the storefront, sees a seeded product with a
// gross PLN price, and audits WCAG 2.2 AA (Constitution V).
test("home page lists a seeded product and has no accessibility violations", async ({
  page,
}) => {
  await page.goto("/pl")

  await expect(page.getByText(/\(test\)/).first()).toBeVisible()
  await expect(page.getByText(/zł/).first()).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze()

  expect(results.violations).toEqual([])
})
