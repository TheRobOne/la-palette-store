import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import { deliverEmail, type EmailDeliveryOptions } from "./deliver"

/**
 * Notification Module provider for the `email` channel (spec 006 research
 * R-02): renders `notification.template` with `notification.data` and sends
 * it through Resend. Errors are thrown so the module records `failure`.
 */
export class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = "resend"

  protected readonly options_: EmailDeliveryOptions
  protected readonly logger_: Logger

  constructor({ logger }: { logger: Logger }, options: EmailDeliveryOptions) {
    super()
    this.options_ = options
    this.logger_ = logger
  }

  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    if (!notification?.template) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "E-mail notification without a template")
    }
    return deliverEmail(
      this.options_,
      {
        to: notification.to,
        template: notification.template,
        data: notification.data,
        idempotency_key: (notification as { idempotency_key?: string | null }).idempotency_key,
      },
      this.logger_
    )
  }
}
