import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { withCapacityLock } from "../lib/pickup-booking"
import { emitRequestEvent, REQUEST_EVENTS } from "../lib/request-events"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"
import { selectExpired } from "../modules/catering/scheduling/requests"

/**
 * Ends requests whose deadline passed (specs/005-on-request-terms US4):
 * unanswered → expired, confirmed but unpaid → canceled; both free their
 * place. Payment re-checks deadlines itself, so a late run never lets a late
 * payment through.
 */
export async function expirePickupRequests(container: MedusaContainer, now = new Date()) {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)

  const candidates = await catering.listBookings({
    requires_confirmation: true,
    status: ["requested", "confirmed"],
  })
  const { expire, cancel } = selectExpired(candidates, now)
  const byId = new Map(candidates.map((b) => [b.id, b]))

  for (const [ids, status] of [
    [expire, "expired"],
    [cancel, "canceled"],
  ] as const) {
    for (const id of ids) {
      const booking = byId.get(id)!
      await withCapacityLock(container, booking.date, async () => {
        // re-read under the lock: staff may have decided meanwhile
        const [current] = await catering.listBookings({ id })
        if (current && current.status === booking.status) {
          await catering.updateBookings({ id, status })
          await emitRequestEvent(
            container,
            status === "expired" ? REQUEST_EVENTS.expired : REQUEST_EVENTS.canceled,
            booking
          )
        }
      })
    }
  }

  if (expire.length || cancel.length) {
    logger.info(`Pickup requests: ${expire.length} expired, ${cancel.length} canceled (unpaid).`)
  }
  return { expired: expire, canceled: cancel }
}

export default async function expirePickupRequestsJob(container: MedusaContainer) {
  await expirePickupRequests(container)
}

export const config = {
  name: "expire-pickup-requests",
  schedule: "*/5 * * * *",
}
