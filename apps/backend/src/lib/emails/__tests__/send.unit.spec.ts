import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { notificationSettingsFromMetadata } from "../../notification-settings"
import { sendEmail, sendStaffEmail } from "../send"

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }

function container(createNotifications: jest.Mock, storeMetadata: Record<string, unknown> = {}) {
  const services: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: logger,
    [Modules.NOTIFICATION]: { createNotifications },
    [ContainerRegistrationKeys.QUERY]: {
      graph: jest.fn().mockResolvedValue({ data: [{ id: "store", metadata: storeMetadata }] }),
    },
  }
  return { resolve: (key: string) => services[key] } as never
}

const input = {
  template: "order-confirmation" as const,
  to: "klient@example.com",
  data: {} as never,
  resource: { type: "order" as const, id: "order_1" },
  trigger: "order.placed",
  key: "order-confirmation:order_1",
}

describe("sendEmail (unit)", () => {
  beforeEach(() => jest.clearAllMocks())

  it("creates an e-mail notification with the idempotency key and resource", async () => {
    const create = jest.fn().mockResolvedValue({})
    expect(await sendEmail(container(create), input)).toBe(true)
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "klient@example.com",
        channel: "email",
        template: "order-confirmation",
        resource_type: "order",
        resource_id: "order_1",
        trigger_type: "order.placed",
        idempotency_key: "order-confirmation:order_1",
        data: expect.objectContaining({ _attempts: 1 }),
      })
    )
  })

  it("never throws when sending fails (FR-008)", async () => {
    const create = jest.fn().mockRejectedValue(new Error("Resend down"))
    await expect(sendEmail(container(create), input)).resolves.toBe(false)
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("Resend down"))
  })

  it("skips a missing recipient", async () => {
    const create = jest.fn()
    expect(await sendEmail(container(create), { ...input, to: null })).toBe(false)
    expect(create).not.toHaveBeenCalled()
  })

  it("sends staff e-mails to the address from store metadata, or skips them", async () => {
    const create = jest.fn().mockResolvedValue({})
    const staff = { ...input, template: "staff-new-order" as const, key: "staff-new-order:order_1" }
    const { to: _to, ...staffInput } = staff

    expect(await sendStaffEmail(container(create), staffInput)).toBe(false)
    expect(create).not.toHaveBeenCalled()

    expect(
      await sendStaffEmail(container(create, { catering_staff_email: "kuchnia@lapalettegarden.pl" }), staffInput)
    ).toBe(true)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ to: "kuchnia@lapalettegarden.pl" }))
  })
})

describe("notification settings from store metadata (unit)", () => {
  it("validates the address and clamps the reminder hours", () => {
    expect(notificationSettingsFromMetadata(undefined)).toEqual({ staffEmail: null, staffReminderHours: 4 })
    expect(
      notificationSettingsFromMetadata({ catering_staff_email: " k@x.pl ", catering_staff_reminder_hours: "6" })
    ).toEqual({ staffEmail: "k@x.pl", staffReminderHours: 6 })
    expect(notificationSettingsFromMetadata({ catering_staff_email: "nope", catering_staff_reminder_hours: 99 })).toEqual({
      staffEmail: null,
      staffReminderHours: 24,
    })
    expect(notificationSettingsFromMetadata({ catering_staff_reminder_hours: "" }).staffReminderHours).toBe(4)
  })
})
