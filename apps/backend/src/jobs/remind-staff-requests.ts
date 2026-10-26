import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { loadRequestEmailData } from "../lib/emails/data"
import { sendStaffEmail } from "../lib/emails/send"
import { loadNotificationSettings } from "../lib/notification-settings"
import { CATERING_MODULE } from "../modules/catering"
import type CateringModuleService from "../modules/catering/service"

const HOUR_MS = 3_600_000

type Candidate = { id: string; status: string; response_deadline?: Date | string | null }

/** Undecided requests whose response deadline falls within (now, now + hours]. */
export function selectRequestsToRemind(requests: Candidate[], now: Date, hours: number): string[] {
  const limit = now.getTime() + hours * HOUR_MS
  return requests
    .filter((r) => {
      if (r.status !== "requested" || !r.response_deadline) {
        return false
      }
      const deadline = new Date(r.response_deadline).getTime()
      return deadline > now.getTime() && deadline <= limit
    })
    .map((r) => r.id)
}

/**
 * Reminds staff once about a request still undecided shortly before its
 * response deadline (spec 006 FR-004; default 4 h, Settings → Store). The
 * idempotency key makes repeated runs send nothing new.
 */
export async function remindStaffRequests(container: MedusaContainer, now = new Date()) {
  const catering: CateringModuleService = container.resolve(CATERING_MODULE)
  const { staffEmail, staffReminderHours } = await loadNotificationSettings(container)
  if (!staffEmail) {
    return { reminded: [] as string[] }
  }
  const candidates = await catering.listBookings({
    requires_confirmation: true,
    status: "requested",
  })
  const ids = selectRequestsToRemind(candidates, now, staffReminderHours)

  for (const id of ids) {
    try {
      const data = await loadRequestEmailData(container, id)
      await sendStaffEmail(container, {
        template: "staff-request-reminder",
        data,
        resource: { type: "pickup_request", id },
        trigger: "remind-staff-requests",
        key: `staff-request-reminder:${id}`,
      })
    } catch (error) {
      container
        .resolve(ContainerRegistrationKeys.LOGGER)
        .error(`Staff reminder for request ${id} failed: ${(error as Error).message}`)
    }
  }
  return { reminded: ids }
}

export default async function remindStaffRequestsJob(container: MedusaContainer) {
  await remindStaffRequests(container)
}

export const config = {
  name: "remind-staff-requests",
  schedule: "*/15 * * * *",
}
