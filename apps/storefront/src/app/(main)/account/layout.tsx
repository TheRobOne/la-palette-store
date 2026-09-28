import { retrieveCustomer } from "@lib/data/customer"
// TODO: Re-add Toaster component when needed
import AccountLayout from "@modules/account/templates/account-layout"

// Every page under /account depends on the signed-in customer and their live
// data (orders, addresses...); now that this subtree no longer sits under a
// dynamic [countryCode] segment, Next would otherwise try to prerender parts
// of it at build time, where no real backend/key is available (constitution:
// CI builds need no database/external service). Force the whole subtree to
// render per-request instead.
export const dynamic = "force-dynamic"

export default async function AccountPageLayout({
  dashboard,
  login,
}: {
  dashboard?: React.ReactNode
  login?: React.ReactNode
}) {
  const customer = await retrieveCustomer().catch(() => null)

  return (
    <AccountLayout customer={customer}>
      {customer ? dashboard : login}
      {/* TODO: Re-add Toaster component when needed */}
    </AccountLayout>
  )
}
