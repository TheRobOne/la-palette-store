import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { notificationSettingsFromMetadata } from "./notification-settings-metadata"

/**
 * Notification settings staff edit in the Admin (Settings → Store widget),
 * stored in the store's metadata like the minimum order value
 * (specs/006-transactional-emails data-model "Store metadata").
 */
export {
  DEFAULT_STAFF_REMINDER_HOURS,
  STAFF_EMAIL_METADATA_KEY,
  STAFF_REMINDER_HOURS_METADATA_KEY,
  notificationSettingsFromMetadata,
} from "./notification-settings-metadata"

export async function loadNotificationSettings(container: MedusaContainer) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: stores } = await query.graph({ entity: "store", fields: ["id", "metadata"] })
  return notificationSettingsFromMetadata(stores[0]?.metadata)
}
