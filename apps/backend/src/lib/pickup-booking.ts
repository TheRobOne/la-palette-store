import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"
import type { DeliveryQuote } from "../modules/catering/delivery/quote"
import type { BookingStatus, RequestSnapshot } from "../modules/catering/models/booking"
import {
  checkTerm,
  termRequiresConfirmation,
} from "../modules/catering/scheduling/availability"
import { loadSchedulingContext } from "../modules/catering/scheduling/load"
import {
  canPay,
  paymentTimeOverError,
  requiresConfirmationError,
  snapshotMatches,
  snapshotMismatchError,
} from "../modules/catering/scheduling/requests"
import {
  type CateringTerm,
  lockBusyError,
  unavailableTermError,
} from "../modules/catering/scheduling/term"
import { outOfZoneRequestError } from "./delivery-checks"

/** Delivery columns of a booking (spec 007); all null for pickup. */
export function bookingDeliveryFields(delivery: DeliveryQuote | null | undefined) {
  if (!delivery) {
    return {}
  }
  return {
    delivery_postal_code: delivery.postal_code,
    delivery_zone_id: delivery.zone?.id ?? null,
    delivery_zone_name: delivery.zone?.name ?? null,
    delivery_cost: delivery.amount,
  }
}

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

/** What the completion hook must undo if a later workflow step fails. */
export type BookingCompensation =
  | { created: string; superseded?: { id: string; status: BookingStatus }[] }
  | {
      revert: {
        id: string
        status: "confirmed"
        delivery_postal_code?: string | null
        delivery_zone_id?: string | null
        delivery_zone_name?: string | null
        delivery_cost?: number | null
      }
    }
  | undefined

/** Requests that still hold a place (spec 005); a standard completion supersedes them. */
const OPEN_REQUEST_STATUSES: BookingStatus[] = ["requested", "confirmed"]

type CartForReservation = {
  id: string
  items?: { variant_id?: string | null; quantity: number | string }[] | null
}

/**
 * Takes the cart's place in the daily capacity when it is completed.
 *
 * - Standard window (004): re-check the term and create an `active` booking,
 *   or accept an existing `active` booking for the same term (retried
 *   completion — neither counted twice nor deleted on failure).
 * - On-request window (spec 005, FR-003a) or an out-of-zone delivery on any
 *   window (spec 007 FR-010): only a `confirmed` request within
 *   its payment deadline whose cart still matches the snapshot can be paid;
 *   it becomes `active`. Its place is already held, so capacity is not
 *   re-checked. Its delivery columns take the quote the customer pays (a zone
 *   price may have changed since sending).
 * - A cart paid on a standard window no longer needs its open requests (the
 *   customer changed the term or the postal code): they become `canceled` so
 *   their place is not counted twice.
 */
export async function reservePickupTerm(
  container: MedusaContainer,
  cart: CartForReservation,
  term: CateringTerm,
  delivery: DeliveryQuote | null = null
): Promise<BookingCompensation> {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)

  return withCapacityLock(container, term.date, async () => {
    const loadContext = () =>
      loadSchedulingContext(container, { method: term.method, from: term.date, to: term.date })
    let context = await loadContext()

    // An out-of-zone delivery always needs the kitchen's confirmation and a
    // staff-set cost (spec 007 FR-010), on any window.
    if (termRequiresConfirmation(term, context) || delivery?.status === "out_of_zone") {
      const [request] = await catering.listBookings(
        { cart_id: cart.id, requires_confirmation: true },
        { order: { created_at: "DESC" }, take: 1 }
      )
      if (!request || request.status === "requested") {
        throw delivery?.status === "out_of_zone"
          ? outOfZoneRequestError()
          : requiresConfirmationError()
      }
      if (request.status === "active" && sameTerm(request, term)) {
        return undefined
      }
      if (!canPay(request, new Date())) {
        throw paymentTimeOverError()
      }
      if (!snapshotMatches(request.request_snapshot as RequestSnapshot, cart, term, delivery)) {
        throw snapshotMismatchError()
      }
      // out of zone, but no cost agreed for this code (e.g. the zone of an
      // in-zone request was deleted): staff must price it first
      if (delivery?.status === "out_of_zone" && delivery.amount === null) {
        throw outOfZoneRequestError()
      }
      const delivered = bookingDeliveryFields(delivery)
      await catering.updateBookings({ id: request.id, status: "active", ...delivered })
      return {
        revert: {
          id: request.id,
          status: "confirmed",
          ...(delivery
            ? {
                delivery_postal_code: request.delivery_postal_code,
                delivery_zone_id: request.delivery_zone_id,
                delivery_zone_name: request.delivery_zone_name,
                delivery_cost:
                  request.delivery_cost === null ? null : Number(request.delivery_cost),
              }
            : {}),
        },
      }
    }

    const existing = await catering.listBookings({ cart_id: cart.id, status: "active" })
    if (existing.some((b) => sameTerm(b, term))) {
      return undefined
    }
    // A stale booking for another term (should not survive a failed attempt,
    // which is compensated) must not block the cart's new term.
    if (existing.length) {
      await catering.deleteBookings(existing.map((b) => b.id))
    }

    const openRequests = await catering.listBookings({
      cart_id: cart.id,
      requires_confirmation: true,
      status: OPEN_REQUEST_STATUSES,
    })
    const superseded = openRequests.map((r) => ({ id: r.id, status: r.status as BookingStatus }))
    if (superseded.length) {
      await catering.updateBookings(
        superseded.map(({ id }) => ({ id, status: "canceled" as const }))
      )
      context = await loadContext()
    }

    try {
      if (checkTerm(term, context).length > 0) {
        throw unavailableTermError(term)
      }
      const booking = await catering.createBookings({
        cart_id: cart.id,
        fulfillment_method: term.method,
        date: term.date,
        start_time: term.start,
        end_time: term.end,
        status: "active",
        ...bookingDeliveryFields(delivery),
      })
      return superseded.length ? { created: booking.id, superseded } : { created: booking.id }
    } catch (error) {
      // the hook's compensation does not run for its own failure
      if (superseded.length) {
        await catering.updateBookings(superseded)
      }
      throw error
    }
  })
}

/** Compensation: removes a created booking or returns a paid request to `confirmed`. */
export async function releasePickupBooking(
  compensation: BookingCompensation,
  container: MedusaContainer
): Promise<void> {
  if (!compensation) {
    return
  }
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  if ("created" in compensation) {
    await catering.deleteBookings(compensation.created)
    if (compensation.superseded?.length) {
      await catering.updateBookings(compensation.superseded)
    }
  } else {
    await catering.updateBookings(compensation.revert)
  }
}
