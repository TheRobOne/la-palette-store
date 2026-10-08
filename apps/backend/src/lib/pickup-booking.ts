import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"
import { checkTerm } from "../modules/catering/scheduling/availability"
import { loadSchedulingContext } from "../modules/catering/scheduling/load"
import {
  type CateringTerm,
  lockBusyError,
  unavailableTermError,
} from "../modules/catering/scheduling/term"

/**
 * Taking a place in the kitchen's daily capacity when a cart is completed
 * (specs/004-pickup-scheduling research R-03). Count + insert run under one
 * lock per date, so two carts competing for the last place are serialised;
 * the booking row is the capacity record.
 */

/** Lock key shared by completion and staff reschedules of the same date. */
export const capacityLockKey = (date: string) => `catering:capacity:${date}`

const LOCK_TIMEOUT_SECONDS = 5

/**
 * Runs `job` under the capacity lock of `date`. A failure to acquire the lock
 * (timeout) becomes the customer-readable "try again" error; errors thrown by
 * the job itself pass through unchanged.
 */
export async function withCapacityLock<T>(
  container: MedusaContainer,
  date: string,
  job: () => Promise<T>
): Promise<T> {
  const locking = container.resolve(Modules.LOCKING)
  let started = false
  try {
    return await locking.execute(
      capacityLockKey(date),
      async () => {
        started = true
        return await job()
      },
      { timeout: LOCK_TIMEOUT_SECONDS }
    )
  } catch (error) {
    if (!started && !(error instanceof MedusaError)) {
      throw lockBusyError()
    }
    throw error
  }
}

const sameTerm = (
  booking: { date: string; start_time: string; end_time: string; fulfillment_method: string },
  term: CateringTerm
) =>
  booking.date === term.date &&
  booking.start_time === term.start &&
  booking.end_time === term.end &&
  booking.fulfillment_method === term.method

/**
 * Re-checks the term and books it for the cart. Returns the id of the
 * booking created by this call (for compensation), or undefined when the
 * cart already holds an active booking for the same term — a retried
 * completion must neither count it twice nor delete it on failure.
 */
export async function reservePickupTerm(
  container: MedusaContainer,
  cartId: string,
  term: CateringTerm
): Promise<string | undefined> {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)

  return withCapacityLock(container, term.date, async () => {
    const existing = await catering.listBookings({ cart_id: cartId, status: "active" })
    if (existing.some((b) => sameTerm(b, term))) {
      return undefined
    }
    // A stale booking for another term (should not survive a failed attempt,
    // which is compensated) must not block the cart's new term.
    if (existing.length) {
      await catering.deleteBookings(existing.map((b) => b.id))
    }

    const context = await loadSchedulingContext(container, {
      method: term.method,
      from: term.date,
      to: term.date,
    })
    if (checkTerm(term, context).length > 0) {
      throw unavailableTermError(term)
    }

    const booking = await catering.createBookings({
      cart_id: cartId,
      fulfillment_method: term.method,
      date: term.date,
      start_time: term.start,
      end_time: term.end,
      status: "active",
    })
    return booking.id
  })
}

/** Compensation: removes the booking created by reservePickupTerm. */
export async function releasePickupBooking(
  bookingId: string | undefined,
  container: MedusaContainer
): Promise<void> {
  if (!bookingId) {
    return
  }
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  await catering.deleteBookings(bookingId)
}
